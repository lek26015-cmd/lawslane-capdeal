import type Stripe from 'stripe';
import { SUBSCRIPTION_PLANS, PlanId } from '@/lib/subscription';

/**
 * ตรรกะตัดสินใจเรื่องแพลน CapDeal ที่ไม่แตะ Stripe/Firestore — แยกไว้ให้เทสต์ได้
 * (scripts/tests/capdeal-billing.test.ts) ตัวที่เรียก API อยู่ใน api/webhooks/stripe/route.ts
 *
 * ทุก Checkout/Subscription ของ CapDeal ต้องมี metadata.product = 'capdeal_plan'
 * บัญชี Stripe นี้ใช้ร่วมกับแพลนทนาย/ล่ามของ Lawslane (lawyer_plan / interpreter_plan)
 * event ที่ไม่ใช่ของเราต้องข้าม ไม่ใช่เดาจาก customer หรือ price
 */
export const CAPDEAL_PRODUCT = 'capdeal_plan';

/** status ที่ Stripe ยังถือว่า subscription มีชีวิตอยู่ — มีแล้วห้ามสร้างตัวที่สอง ต้องไปที่ portal */
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused']);
// ให้ใช้สิทธิ์ได้ — past_due มีเงื่อนไขเพิ่ม (ผ่อนผัน 3 วัน)
const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due']);
// เผื่อ webhook ต่ออายุมาช้า
export const PERIOD_GRACE_MS = 3 * 24 * 60 * 60 * 1000;
// บัตรตัดไม่ผ่าน (past_due) ใช้ต่อได้ 3 วันนับจากที่เริ่มค้างชำระ (PLAN-08 เฟส 1)
export const PAST_DUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export function isCapdealProduct(metadata: Record<string, string> | null | undefined): boolean {
    return metadata?.product === CAPDEAL_PRODUCT;
}

/**
 * Price → แพลน ต้องรู้จัก Price จริงเท่านั้น ไม่รู้จัก = null (ห้ามเดาจาก metadata.planId)
 * (TODO เฟส 2: รู้จัก previousPriceIds จาก planPricing/capdeal ด้วย)
 */
export function planIdForPriceId(priceId: string | null | undefined): PlanId | null {
    if (!priceId) return null;
    for (const plan of Object.values(SUBSCRIPTION_PLANS)) {
        if (plan.id === 'free') continue;
        if (plan.stripePriceId === priceId || plan.stripeYearlyPriceId === priceId) {
            return plan.id as PlanId;
        }
    }
    return null;
}

function toMillis(v: any): number | null {
    if (!v) return null;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
        const t = Date.parse(v);
        return Number.isNaN(t) ? null : t;
    }
    return null;
}

/** มี subscription ใน Stripe ที่ยังไม่จบ (รวม past_due/unpaid) — ใช้กันสมัครซ้ำ และพาไป portal */
export function hasLiveSubscription(subscription: any): boolean {
    return Boolean(subscription?.subscriptionId) && LIVE_STATUSES.has(subscription?.status);
}

/**
 * users.subscription ยังให้สิทธิ์แพลนอยู่ไหม
 * - active/trialing: ถึงสิ้นรอบ + ผ่อนผัน 3 วัน (เผื่อ webhook ต่ออายุมาช้า)
 * - past_due: 3 วันนับจาก pastDueSince (ถ้าไม่มีใช้ paymentFailedAt) — ไม่ใช่ทั้งรอบบิล
 *   เพราะพอบัตรตัดไม่ผ่าน Stripe เลื่อน currentPeriodEnd ไปรอบใหม่แล้ว
 */
export function isSubscriptionEntitled(subscription: any, now = Date.now()): boolean {
    if (!subscription || !ENTITLED_STATUSES.has(subscription.status)) return false;
    const end = toMillis(subscription.currentPeriodEnd);
    if (end !== null && end + PERIOD_GRACE_MS <= now) return false;
    if (subscription.status === 'past_due') {
        const since = toMillis(subscription.pastDueSince) ?? toMillis(subscription.paymentFailedAt);
        // ไม่รู้ว่าเริ่มค้างเมื่อไหร่ → ไม่ให้สิทธิ์ (ปลอดภัยไว้ก่อน webhook รอบถัดไปจะเติมให้)
        if (since === null) return false;
        return since + PAST_DUE_GRACE_MS > now;
    }
    return true;
}

/**
 * อ่านรอบบิลจาก subscription — API version ใหม่ (2025-03-31 basil ขึ้นไป) ย้าย
 * current_period_* ไปอยู่ที่ items แล้ว
 */
export function periodOf(subscription: Stripe.Subscription): { start: Date | null; end: Date | null } {
    const item = subscription.items?.data?.[0];
    const toDate = (sec: unknown) => (typeof sec === 'number' && Number.isFinite(sec) ? new Date(sec * 1000) : null);
    return { start: toDate(item?.current_period_start), end: toDate(item?.current_period_end) };
}

export function priceOf(subscription: Stripe.Subscription): Stripe.Price | null {
    return subscription.items?.data?.[0]?.price ?? null;
}

export function idOf(v: string | { id: string } | null | undefined): string | null {
    if (!v) return null;
    return typeof v === 'string' ? v : v.id;
}

/**
 * Checkout จบแล้วให้สิทธิ์ได้ไหม — ต้องเป็นของ CapDeal, โหมด subscription และจ่ายเงินแล้วจริง
 * ('no_payment_required' = คูปอง 100%) · 'unpaid' คือจ่ายแบบ async ที่ยังไม่เข้า ให้รอ
 * checkout.session.async_payment_succeeded
 */
export function checkoutFulfillable(session: Pick<Stripe.Checkout.Session, 'mode' | 'status' | 'payment_status' | 'metadata' | 'subscription'>):
    { ok: true } | { ok: false; reason: string } {
    if (!isCapdealProduct(session.metadata)) return { ok: false, reason: 'not_capdeal' };
    if (session.mode !== 'subscription') return { ok: false, reason: 'not_subscription_mode' };
    if (session.status !== 'complete') return { ok: false, reason: 'not_complete' };
    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
        return { ok: false, reason: `payment_${session.payment_status}` };
    }
    if (!idOf(session.subscription as any)) return { ok: false, reason: 'no_subscription' };
    return { ok: true };
}

/**
 * subscription ที่ได้มาควรเขียนทับ users.subscription ไหม
 * - ตัวเดียวกับที่บันทึกไว้ หรือยังไม่มี → เขียน
 * - คนละตัว และตัวที่บันทึกไว้ยังมีชีวิตอยู่จริง (ยืนยันจาก Stripe แล้ว) → ห้ามเขียนทับ
 *   ถ้าตัวใหม่ก็มีชีวิตด้วย = สมัครซ้ำ ต้องแจ้งแอดมิน
 */
export function decideSubscriptionWrite(
    currentSubscriptionId: string | null | undefined,
    currentStillLive: boolean,
    incoming: { id: string; status: string },
): 'write' | 'skip_non_current' | 'duplicate' {
    if (!currentSubscriptionId || currentSubscriptionId === incoming.id || !currentStillLive) return 'write';
    return LIVE_STATUSES.has(incoming.status) ? 'duplicate' : 'skip_non_current';
}

export function isLiveStatus(status: string | null | undefined): boolean {
    return !!status && LIVE_STATUSES.has(status);
}

/**
 * pastDueSince ที่ควรบันทึก: เข้า past_due ครั้งแรกใช้เวลานี้, ค้างต่อใช้ค่าเดิม, หายแล้วล้าง
 */
export function nextPastDueSince(status: string, previous: number | null, now = Date.now()): number | null {
    if (status !== 'past_due') return null;
    return previous ?? now;
}

export { toMillis };

/** ชื่อตาม helper กลางของ PLAN-08 — ตัวเดียวกับ planIdForPriceId */
export const resolvePlanFromPrice = planIdForPriceId;
