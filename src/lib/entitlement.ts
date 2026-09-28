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
 *  - scans: จำนวนครั้งที่เรียก AI อ่านแคป — กันยิงรัวให้เสียค่า AI (ค่าเริ่มต้น = deals × 3, ขั้นต่ำ 10)
 *
 * แอดมินกำหนดได้ที่หลังบ้าน (lawslane-admin → CapDeal → แพ็กเกจและสิทธิ์):
 *  - `planEntitlements/capdeal` → ลิมิต/ฟีเจอร์ของแต่ละแพ็กเกจ (ไม่มีเอกสาร = ค่าในโค้ด)
 *  - `users/{uid}.planGrants.capdeal` → มอบแพ็กเกจให้ลูกค้ารายคน (+ วันหมดอายุ)
 *    ใช้แพ็กเกจที่สูงกว่าระหว่าง Stripe กับที่แอดมินมอบ — มอบให้ลูกค้าที่จ่ายอยู่แล้ว
 *    จะไม่ทำให้แพ็กเกจลดลง และไม่แตะ users.subscription ที่ webhook ของ Stripe เป็นเจ้าของ
 *  ทั้งสองที่ client เขียนเองไม่ได้ — โครงข้อมูลต้องตรงกับ lawslane-admin/src/lib/plan-entitlements.ts
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

// ลำดับแพ็กเกจจากต่ำไปสูง — ใช้เลือกตัวที่สูงกว่าระหว่าง Stripe กับที่แอดมินมอบ
const PLAN_ORDER = ['free', 'lite', 'pro', 'scale'];

export type PlanEntitlements = {
    dealsPerMonth: number;
    scansPerMonth: number;
    /** แนบเอกสารท้ายสัญญา */
    attachments: boolean;
    /** เอกสาร/PDF ไม่มีลายน้ำ Lawslane */
    hideWatermark: boolean;
};

function defaultEntitlements(plan: SubscriptionPlan): PlanEntitlements {
    return {
        dealsPerMonth: plan.limits.dealsPerMonth,
        scansPerMonth: scanLimitFor(plan),
        attachments: plan.id !== 'free',
        hideWatermark: plan.id !== 'free',
    };
}

function nonNegativeInt(v: unknown): number | null {
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
}

/** ค่าที่แอดมินตั้ง — ฟิลด์ที่หาย/ชนิดผิดใช้ค่าเริ่มต้น, scansPerMonth = null คือคำนวณจาก deals */
function normalizeEntitlements(raw: any, plan: SubscriptionPlan): PlanEntitlements {
    const base = defaultEntitlements(plan);
    const deals = nonNegativeInt(raw?.dealsPerMonth) ?? base.dealsPerMonth;
    return {
        dealsPerMonth: deals,
        scansPerMonth: nonNegativeInt(raw?.scansPerMonth) ?? Math.max(deals * 3, 10),
        attachments: typeof raw?.attachments === 'boolean' ? raw.attachments : base.attachments,
        hideWatermark: typeof raw?.hideWatermark === 'boolean' ? raw.hideWatermark : base.hideWatermark,
    };
}

async function loadPlanConfig(db: FirebaseFirestore.Firestore): Promise<Record<string, any>> {
    const snap = await db.collection('planEntitlements').doc('capdeal').get().catch(() => null);
    return snap?.data()?.plans ?? {};
}

/** แพ็กเกจที่แอดมินมอบ — หมดอายุ/ไม่รู้จักถือว่าไม่มี */
export function planFromGrant(grant: any, now = Date.now()): { plan: SubscriptionPlan; expiresAt: Date | null } | null {
    const plan = grant && SUBSCRIPTION_PLANS[grant.planId as PlanId];
    if (!plan) return null;
    const expiresAt: Date | null = grant.expiresAt?.toDate?.() ?? null;
    if (expiresAt && expiresAt.getTime() <= now) return null;
    return { plan, expiresAt };
}

type ResolvedPlan = {
    plan: SubscriptionPlan;
    source: 'stripe' | 'admin' | 'free';
    grantExpiresAt: Date | null;
    entitlements: PlanEntitlements;
};

function resolvePlan(userData: any, config: Record<string, any>): ResolvedPlan {
    const paid = planFromSubscription(userData?.subscription);
    const grant = planFromGrant(userData?.planGrants?.capdeal);
    const useGrant = grant && PLAN_ORDER.indexOf(grant.plan.id) > PLAN_ORDER.indexOf(paid.id);
    const plan = useGrant ? grant.plan : paid;
    return {
        plan,
        source: useGrant ? 'admin' : paid.id === 'free' ? 'free' : 'stripe',
        grantExpiresAt: useGrant ? grant.expiresAt : null,
        entitlements: normalizeEntitlements(config[plan.id], plan),
    };
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
    /** แพ็กเกจมาจากไหน: จ่ายผ่าน Stripe / แอดมินมอบให้ / ไม่มี */
    planSource: ResolvedPlan['source'];
    planExpiresAt: string | null;
    features: { attachments: boolean; hideWatermark: boolean };
    period: string;
    deals: number;
    dealsLimit: number;
    scans: number;
    scansLimit: number;
};

export async function getUsageSummary(db: FirebaseFirestore.Firestore, uid: string): Promise<UsageSummary> {
    const [userSnap, usageSnap, config] = await Promise.all([
        db.collection('users').doc(uid).get(),
        usageRef(db, uid).get(),
        loadPlanConfig(db),
    ]);
    const resolved = resolvePlan(userSnap.data(), config);
    const usage = usageSnap.data() ?? {};
    return summarize(resolved, currentUsagePeriod(), usage.deals ?? 0, usage.scans ?? 0);
}

function summarize(resolved: ResolvedPlan, period: string, deals: number, scans: number): UsageSummary {
    const { plan, entitlements } = resolved;
    return {
        planId: plan.id as PlanId,
        planName: plan.name,
        isPaid: plan.id !== 'free',
        planSource: resolved.source,
        planExpiresAt: resolved.grantExpiresAt?.toISOString() ?? null,
        features: { attachments: entitlements.attachments, hideWatermark: entitlements.hideWatermark },
        period,
        deals,
        dealsLimit: entitlements.dealsPerMonth,
        scans,
        scansLimit: entitlements.scansPerMonth,
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
    // ค่าที่แอดมินตั้งอ่านนอก transaction — ไม่ต้องล็อกเอกสาร config ทุกครั้งที่มีคนสร้างสัญญา
    const config = await loadPlanConfig(db);

    return db.runTransaction(async (tx) => {
        const [userSnap, usageSnap] = await Promise.all([tx.get(userRef), tx.get(ref)]);
        const resolved = resolvePlan(userSnap.data(), config);
        const { plan } = resolved;
        const usage = usageSnap.data() ?? {};
        const deals = usage.deals ?? 0;
        const scans = usage.scans ?? 0;
        const dealsLimit = resolved.entitlements.dealsPerMonth;
        const scansLimit = resolved.entitlements.scansPerMonth;

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

        return summarize(
            resolved,
            period,
            deals + (kind === 'deals' ? 1 : 0),
            scans + (kind === 'scans' ? 1 : 0),
        );
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
