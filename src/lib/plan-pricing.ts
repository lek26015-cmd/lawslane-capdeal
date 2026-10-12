import 'server-only';
import { initAdmin } from '@/lib/firebase-admin';
import { CAPDEAL_PRICING_DOC, CapdealPricing, createPricingLoader } from '@/lib/plan-pricing-core';

/**
 * อ่านราคากลาง `{PLAN_PRICING_COLLECTION || 'planPricing'}/capdeal` ด้วย Admin SDK (PLAN-08 เฟส 2)
 * - rules ของ collection นี้ปิดทั้งหมด อ่าน/เขียนผ่าน Admin SDK เท่านั้น
 * - Stripe test mode ต้องตั้ง PLAN_PRICING_COLLECTION=planPricing_test (Firestore ใช้ร่วมกับ production)
 * - แคป 60 วินาที · อ่านไม่ได้/ไม่มีเอกสาร = ราคาใน subscription.ts + Price ID จาก env
 */
export function planPricingCollection(): string {
    return process.env.PLAN_PRICING_COLLECTION?.trim() || 'planPricing';
}

const loader = createPricingLoader(async () => {
    const app = await initAdmin();
    if (!app) throw new Error('Firebase Admin not initialized');
    const snap = await app.firestore().collection(planPricingCollection()).doc(CAPDEAL_PRICING_DOC).get();
    return snap.exists ? snap.data() : null;
});

export function getCapdealPricing(): Promise<CapdealPricing> {
    return loader.get();
}

export {
    checkoutPriceIdFor,
    planIdForPriceIdIn,
    publicAmounts,
} from '@/lib/plan-pricing-core';
export type { CapdealPricing, PublicPlanAmounts } from '@/lib/plan-pricing-core';
