import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { SUBSCRIPTION_PLANS, PlanId, SubscriptionPlan } from '@/lib/subscription';

/**
 * สิทธิ์แพ็กเกจและโควตา — ตัดสินฝั่ง server เท่านั้น
 *
 * เดิมทุกลิมิตเช็คใน client (useSubscription) จึงข้ามได้ด้วยการยิง API หรือ Firestore ตรง
 * และนับโควตาจากจำนวน contracts ที่ owner แก้/ลบเองได้ แพลนรายปีก็ไม่เคยโดนนับ
 * (รอบคำนวณเป็น currentPeriodEnd − 1 เดือน ซึ่งอยู่ในอนาคต)
 *
 * ตอนนี้นับใน `usage/{uid}_{YYYY-MM}` (เดือนตามเวลาไทย) ที่เขียนได้เฉพาะ Admin SDK
 *  - deals: จำนวนสัญญาที่สร้าง — ลิมิตตามแพ็กเกจ
 *  - scans: จำนวนครั้งที่เรียก AI อ่านแคป — กันยิงรัวให้เสียค่า AI (ลิมิต = deals × 3, ขั้นต่ำ 10)
 */

// Stripe ถือว่ายังใช้สิทธิ์ได้ระหว่างรอเก็บเงินซ้ำ (past_due) — ไม่ตัดผู้ใช้ทันทีที่บัตรตัดไม่ผ่าน
const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due']);
// เผื่อ webhook ต่ออายุมาช้า
const PERIOD_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export class QuotaError extends Error {
    status: number;
    code: string;
    constructor(code: string, message: string, status = 403) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

export function planIdForPriceId(priceId: string | null | undefined): PlanId | null {
    if (!priceId) return null;
    for (const plan of Object.values(SUBSCRIPTION_PLANS)) {
        if (plan.stripePriceId === priceId || plan.stripeYearlyPriceId === priceId) {
            return plan.id as PlanId;
        }
    }
    return null;
}

export function isSubscriptionEntitled(subscription: any): boolean {
    if (!subscription || !ENTITLED_STATUSES.has(subscription.status)) return false;
    const end: Date | undefined = subscription.currentPeriodEnd?.toDate?.();
    // ไม่มีวันหมดอายุ = ข้อมูลเก่าก่อนมีฟิลด์นี้ ยึดตาม status
    return !end || end.getTime() + PERIOD_GRACE_MS > Date.now();
}

export function planFromSubscription(subscription: any): SubscriptionPlan {
    if (!isSubscriptionEntitled(subscription)) return SUBSCRIPTION_PLANS.free;
    return SUBSCRIPTION_PLANS[subscription.planId as PlanId] ?? SUBSCRIPTION_PLANS.free;
}

export function scanLimitFor(plan: SubscriptionPlan): number {
    return Math.max(plan.limits.dealsPerMonth * 3, 10);
}

/** เดือนปัจจุบันตามเวลาไทย เช่น "2026-09" */
export function currentUsagePeriod(now = new Date()): string {
    const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    return `${bkk.getUTCFullYear()}-${String(bkk.getUTCMonth() + 1).padStart(2, '0')}`;
}

function usageRef(db: FirebaseFirestore.Firestore, uid: string, period = currentUsagePeriod()) {
    return db.collection('usage').doc(`${uid}_${period}`);
}

export type UsageSummary = {
    planId: PlanId;
    planName: string;
    isPaid: boolean;
    period: string;
    deals: number;
    dealsLimit: number;
    scans: number;
    scansLimit: number;
};

export async function getUsageSummary(db: FirebaseFirestore.Firestore, uid: string): Promise<UsageSummary> {
    const [userSnap, usageSnap] = await Promise.all([db.collection('users').doc(uid).get(), usageRef(db, uid).get()]);
    const plan = planFromSubscription(userSnap.data()?.subscription);
    const usage = usageSnap.data() ?? {};
    return {
        planId: plan.id as PlanId,
        planName: plan.name,
        isPaid: plan.id !== 'free',
        period: currentUsagePeriod(),
        deals: usage.deals ?? 0,
        dealsLimit: plan.limits.dealsPerMonth,
        scans: usage.scans ?? 0,
        scansLimit: scanLimitFor(plan),
    };
}

/**
 * ใช้โควตา 1 หน่วยแบบ atomic — เกินลิมิตจะ throw QuotaError และไม่นับเพิ่ม
 * `extraWrites` รันใน transaction เดียวกัน (เช่นสร้างเอกสารสัญญา) จึงไม่มีทางนับแล้วไม่ได้สร้าง
 */
export async function consumeQuota(
    db: FirebaseFirestore.Firestore,
    uid: string,
    kind: 'deals' | 'scans',
    extraWrites?: (tx: FirebaseFirestore.Transaction) => void,
): Promise<UsageSummary> {
    const userRef = db.collection('users').doc(uid);
    const ref = usageRef(db, uid);
    const period = currentUsagePeriod();

    return db.runTransaction(async (tx) => {
        const [userSnap, usageSnap] = await Promise.all([tx.get(userRef), tx.get(ref)]);
        const plan = planFromSubscription(userSnap.data()?.subscription);
        const usage = usageSnap.data() ?? {};
        const deals = usage.deals ?? 0;
        const scans = usage.scans ?? 0;
        const dealsLimit = plan.limits.dealsPerMonth;
        const scansLimit = scanLimitFor(plan);

        if (kind === 'deals' && deals >= dealsLimit) {
            throw new QuotaError('deal_quota', `แพ็กเกจ ${plan.name} สร้างสัญญาได้สูงสุด ${dealsLimit} ฉบับต่อเดือน`);
        }
        if (kind === 'scans' && (scans >= scansLimit || deals >= dealsLimit)) {
            throw new QuotaError(
                'scan_quota',
                deals >= dealsLimit
                    ? `แพ็กเกจ ${plan.name} สร้างสัญญาครบ ${dealsLimit} ฉบับของเดือนนี้แล้ว`
                    : `ใช้ AI อ่านแคปครบ ${scansLimit} ครั้งของเดือนนี้แล้ว`,
            );
        }

        tx.set(ref, {
            uid,
            period,
            [kind]: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        extraWrites?.(tx);

        return {
            planId: plan.id as PlanId,
            planName: plan.name,
            isPaid: plan.id !== 'free',
            period,
            deals: deals + (kind === 'deals' ? 1 : 0),
            dealsLimit,
            scans: scans + (kind === 'scans' ? 1 : 0),
            scansLimit,
        };
    });
}

/** คืนโควตาที่ใช้ไป (เช่น AI เรียกไม่สำเร็จ) — ไม่ต่ำกว่า 0 */
export async function refundQuota(db: FirebaseFirestore.Firestore, uid: string, kind: 'deals' | 'scans') {
    const ref = usageRef(db, uid);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if ((snap.data()?.[kind] ?? 0) > 0) {
            tx.update(ref, { [kind]: FieldValue.increment(-1) });
        }
    });
}
