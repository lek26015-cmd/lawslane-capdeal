import { SUBSCRIPTION_PLANS } from '@/lib/subscription';

/**
 * ราคากลางของแพลน CapDeal (PLAN-08 เฟส 2) — ส่วนที่ไม่แตะ Firestore/Stripe แยกไว้ให้เทสต์ได้
 * (scripts/tests/capdeal-billing.test.ts) และให้ฝั่ง browser ใช้ค่าเริ่มต้นได้
 * ตัวที่อ่าน Firestore จริงอยู่ใน plan-pricing.ts (server-only)
 *
 * เอกสาร `{PLAN_PRICING_COLLECTION || 'planPricing'}/capdeal` เขียนได้จาก lawslane-admin เท่านั้น
 * โครงข้อมูลต้องตรงกับ lawslane-admin/src/lib/plan-pricing.ts
 * ไม่มีเอกสาร = ใช้ราคาใน subscription.ts + Price ID จาก env เหมือนก่อนเฟส 2 ทุกอย่าง
 */

export const CAPDEAL_PRICING_DOC = 'capdeal';
/** แพลนที่ขายผ่าน Stripe — free ไม่มีราคา และ planId อื่นในเอกสารจะไม่ถูกใช้ */
export const PAID_PLAN_IDS = ['lite', 'pro', 'scale'] as const;
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];
export type BillingInterval = 'month' | 'year';

export type PlanPricingEntry = {
    /** บาทเต็มจำนวน · null = ไม่เปิดขายรอบนี้ */
    monthly: number | null;
    yearly: number | null;
    /** Price ID ปัจจุบันที่ใช้สร้าง Checkout — Firestore ก่อน ไม่มีใช้ env */
    monthlyPriceId: string | null;
    yearlyPriceId: string | null;
    /** Price ทุกตัวที่เคยใช้ (Firestore previousPriceIds + Price ID ใน env) — webhook ยังจับคู่แพลนได้ */
    knownPriceIds: string[];
};

export type CapdealPricing = {
    currency: 'thb';
    plans: Record<PaidPlanId, PlanPricingEntry>;
    portalConfigId: string | null;
    /** มาจากเอกสารใน Firestore หรือค่าเริ่มต้น (ไว้ log/debug เท่านั้น) */
    source: 'firestore' | 'default';
};

/** ราคาที่ส่งให้ browser ได้ — ตัวเลขอย่างเดียว ไม่มี Price ID */
export type PublicPlanAmounts = Record<PaidPlanId, { monthly: number | null; yearly: number | null }>;

function str(v: unknown): string | null {
    return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** บาทเต็มจำนวน ≥ 0 · null = ไม่ขาย · ชนิดผิด/ไม่มีฟิลด์ = undefined (ใช้ค่าเริ่มต้น) */
function amount(v: unknown): number | null | undefined {
    if (v === null) return null;
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v;
    return undefined;
}

function uniq(ids: (string | null | undefined)[]): string[] {
    return Array.from(new Set(ids.filter((x): x is string => !!x)));
}

/** ค่าเริ่มต้น = ราคาใน subscription.ts + Price ID จาก env (อ่านตอนเรียก เพื่อให้เทสต์ตั้ง env ได้) */
export function defaultCapdealPricing(): CapdealPricing {
    const plans = {} as Record<PaidPlanId, PlanPricingEntry>;
    for (const id of PAID_PLAN_IDS) {
        const p = SUBSCRIPTION_PLANS[id];
        const monthlyPriceId = str(p.stripePriceId);
        const yearlyPriceId = str(p.stripeYearlyPriceId);
        plans[id] = {
            monthly: p.price,
            yearly: p.yearlyPrice,
            monthlyPriceId,
            yearlyPriceId,
            knownPriceIds: uniq([monthlyPriceId, yearlyPriceId]),
        };
    }
    return {
        currency: 'thb',
        plans,
        portalConfigId: str(process.env.STRIPE_PORTAL_CONFIG_CAPDEAL),
        source: 'default',
    };
}

/**
 * รวมเอกสาร planPricing/capdeal เข้ากับค่าเริ่มต้น — ฟิลด์ที่หาย/ชนิดผิดใช้ค่าเริ่มต้น
 * - ราคา: ตัวเลขจาก Firestore (null = ไม่ขาย)
 * - Price ปัจจุบัน: stripe.monthlyPriceId/yearlyPriceId ถ้ามี ไม่มีใช้ env
 * - Price ที่รู้จัก: ปัจจุบัน + previousPriceIds + env (Price ใน env ยังมีลูกค้าใช้อยู่ได้)
 * - portal: portalConfigId → env STRIPE_PORTAL_CONFIG_CAPDEAL → null (ค่าเริ่มต้นของบัญชี)
 */
export function mergeCapdealPricing(raw: unknown): CapdealPricing {
    const base = defaultCapdealPricing();
    if (!raw || typeof raw !== 'object') return base;
    const doc = raw as Record<string, any>;
    if (doc.currency !== undefined && doc.currency !== 'thb') {
        // สกุลเงินไม่ตรง = เอกสารผิด ไม่ใช้ทั้งเอกสาร
        console.error(`planPricing/${CAPDEAL_PRICING_DOC}: unsupported currency — using defaults`);
        return base;
    }

    const plans = {} as Record<PaidPlanId, PlanPricingEntry>;
    for (const id of PAID_PLAN_IDS) {
        const def = base.plans[id];
        const entry = doc.plans && typeof doc.plans === 'object' ? doc.plans[id] : undefined;
        if (!entry || typeof entry !== 'object') {
            plans[id] = def;
            continue;
        }
        const stripe = entry.stripe && typeof entry.stripe === 'object' ? entry.stripe : {};
        const previous: unknown[] = Array.isArray(stripe.previousPriceIds) ? stripe.previousPriceIds : [];
        const monthlyPriceId = str(stripe.monthlyPriceId) ?? def.monthlyPriceId;
        const yearlyPriceId = str(stripe.yearlyPriceId) ?? def.yearlyPriceId;
        const monthly = amount(entry.monthly);
        const yearly = amount(entry.yearly);
        plans[id] = {
            monthly: monthly === undefined ? def.monthly : monthly,
            yearly: yearly === undefined ? def.yearly : yearly,
            monthlyPriceId,
            yearlyPriceId,
            knownPriceIds: uniq([monthlyPriceId, yearlyPriceId, ...previous.map(str), ...def.knownPriceIds]),
        };
    }

    return {
        currency: 'thb',
        plans,
        portalConfigId: str(doc.portalConfigId) ?? base.portalConfigId,
        source: 'firestore',
    };
}

/**
 * Price ID สำหรับสร้าง Checkout — null ถ้าแพลน/รอบนี้ไม่ขาย (ราคา null) หรือยังไม่มี Price
 */
export function checkoutPriceIdFor(pricing: CapdealPricing, planId: string, interval: BillingInterval): string | null {
    if (!(PAID_PLAN_IDS as readonly string[]).includes(planId)) return null;
    const entry = pricing.plans[planId as PaidPlanId];
    if (interval === 'year') return entry.yearly === null ? null : entry.yearlyPriceId;
    return entry.monthly === null ? null : entry.monthlyPriceId;
}

/** Price → แพลน จากราคากลาง (รวม Price เก่า) · ไม่รู้จัก = null */
export function planIdForPriceIdIn(pricing: CapdealPricing, priceId: string | null | undefined): PaidPlanId | null {
    if (!priceId) return null;
    for (const id of PAID_PLAN_IDS) {
        if (pricing.plans[id].knownPriceIds.includes(priceId)) return id;
    }
    return null;
}

export function publicAmounts(pricing: CapdealPricing): PublicPlanAmounts {
    const out = {} as PublicPlanAmounts;
    for (const id of PAID_PLAN_IDS) {
        out[id] = { monthly: pricing.plans[id].monthly, yearly: pricing.plans[id].yearly };
    }
    return out;
}

/** ราคาเริ่มต้นสำหรับ browser (ก่อนโหลดจาก server เสร็จ / โหลดไม่ได้) */
export function defaultPublicAmounts(): PublicPlanAmounts {
    const out = {} as PublicPlanAmounts;
    for (const id of PAID_PLAN_IDS) {
        out[id] = { monthly: SUBSCRIPTION_PLANS[id].price, yearly: SUBSCRIPTION_PLANS[id].yearlyPrice };
    }
    return out;
}

/**
 * ตัวโหลดพร้อมแคปในหน่วยความจำ — แยกจาก Firestore ให้เทสต์ด้วย fetcher ปลอมได้
 * - สำเร็จ: แคป ttlMs (60 วินาที)
 * - อ่านไม่ได้: log แล้วใช้ค่าเริ่มต้น แคปสั้นกว่า (errorTtlMs) จะได้ไม่ยิงซ้ำทุก request
 * - หลาย request พร้อมกันใช้การอ่านครั้งเดียวกัน
 */
export function createPricingLoader(
    fetchDoc: () => Promise<unknown>,
    opts: { ttlMs?: number; errorTtlMs?: number; now?: () => number } = {},
) {
    const ttlMs = opts.ttlMs ?? 60_000;
    const errorTtlMs = opts.errorTtlMs ?? 15_000;
    const now = opts.now ?? Date.now;
    let cached: { value: CapdealPricing; expiresAt: number } | null = null;
    let inflight: Promise<CapdealPricing> | null = null;

    async function load(): Promise<CapdealPricing> {
        try {
            const raw = await fetchDoc();
            const value = mergeCapdealPricing(raw);
            cached = { value, expiresAt: now() + ttlMs };
            return value;
        } catch (e: any) {
            // ไม่ log รายละเอียดเกินจำเป็น — ใช้ค่าเริ่มต้นไปก่อน หน้า checkout/pricing ต้องไม่พัง
            console.error(`planPricing/${CAPDEAL_PRICING_DOC}: read failed — using defaults`, e?.code ?? '', e?.message ?? 'unknown');
            const value = defaultCapdealPricing();
            cached = { value, expiresAt: now() + errorTtlMs };
            return value;
        }
    }

    return {
        async get(): Promise<CapdealPricing> {
            if (cached && cached.expiresAt > now()) return cached.value;
            if (!inflight) inflight = load().finally(() => { inflight = null; });
            return inflight;
        },
        clear() {
            cached = null;
        },
    };
}
