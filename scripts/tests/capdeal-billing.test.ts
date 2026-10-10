/**
 * ทดสอบ logic ตัดสินใจของ webhook/สิทธิ์แพลน CapDeal (ไม่เรียก Stripe / Firestore)
 * รัน: npx tsx scripts/tests/capdeal-billing.test.ts
 */
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_LITE = 'price_lite_m';
process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_LITE_YEARLY = 'price_lite_y';
process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO = 'price_pro_m';
process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_YEARLY = 'price_pro_y';
process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_SCALE = 'price_scale_m';
process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_SCALE_YEARLY = '';

(async () => {
    const b = await import('../../src/lib/capdeal-billing');
    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.parse('2026-10-11T00:00:00Z');

    // product filter — ของเว็บอื่นในบัญชีเดียวกันต้องไม่ผ่าน
    assert.equal(b.isCapdealProduct({ product: 'capdeal_plan' }), true);
    assert.equal(b.isCapdealProduct({ product: 'lawyer_plan' }), false);
    assert.equal(b.isCapdealProduct({ product: 'interpreter_plan' }), false);
    assert.equal(b.isCapdealProduct({}), false, 'ไม่มี product = ไม่ใช่ของเรา (ไม่รองรับ subscription เก่า)');
    assert.equal(b.isCapdealProduct(null), false);

    // Price → แพลน: รู้จักเท่านั้น ห้ามเดา
    assert.equal(b.planIdForPriceId('price_lite_m'), 'lite');
    assert.equal(b.planIdForPriceId('price_pro_y'), 'pro');
    assert.equal(b.planIdForPriceId('price_scale_m'), 'scale');
    assert.equal(b.planIdForPriceId('price_unknown'), null);
    assert.equal(b.planIdForPriceId(''), null, 'env ว่างต้องไม่จับคู่กับ price ว่าง');
    assert.equal(b.planIdForPriceId(null), null);
    assert.equal(b.resolvePlanFromPrice('price_pro_m'), 'pro');

    // checkout ให้สิทธิ์ได้ก็ต่อเมื่อเป็นของเรา + subscription + complete + จ่ายแล้ว
    const okSession = {
        mode: 'subscription', status: 'complete', payment_status: 'paid',
        metadata: { product: 'capdeal_plan', uid: 'u1' }, subscription: 'sub_1',
    } as any;
    assert.deepEqual(b.checkoutFulfillable(okSession), { ok: true });
    assert.equal(b.checkoutFulfillable({ ...okSession, payment_status: 'no_payment_required' }).ok, true);
    assert.equal(b.checkoutFulfillable({ ...okSession, payment_status: 'unpaid' }).ok, false, 'async ยังไม่เข้า');
    assert.equal(b.checkoutFulfillable({ ...okSession, mode: 'payment' }).ok, false, 'ไม่มี branch payment แล้ว');
    assert.equal(b.checkoutFulfillable({ ...okSession, status: 'open' }).ok, false);
    assert.equal(b.checkoutFulfillable({ ...okSession, metadata: { product: 'lawyer_plan' } }).ok, false);
    assert.equal(b.checkoutFulfillable({ ...okSession, subscription: null }).ok, false);
    assert.equal(b.checkoutFulfillable({ ...okSession, subscription: { id: 'sub_1' } }).ok, true);

    // กัน subscription ที่ไม่ใช่ตัวปัจจุบันเขียนทับ
    assert.equal(b.decideSubscriptionWrite(null, false, { id: 'sub_new', status: 'active' }), 'write');
    assert.equal(b.decideSubscriptionWrite('sub_1', true, { id: 'sub_1', status: 'canceled' }), 'write', 'ตัวเดียวกัน');
    assert.equal(b.decideSubscriptionWrite('sub_old', false, { id: 'sub_new', status: 'active' }), 'write', 'ตัวเดิมจบแล้ว');
    assert.equal(b.decideSubscriptionWrite('sub_cur', true, { id: 'sub_old', status: 'canceled' }), 'skip_non_current');
    assert.equal(b.decideSubscriptionWrite('sub_cur', true, { id: 'sub_2', status: 'active' }), 'duplicate', 'สมัครซ้ำ → แจ้งแอดมิน');

    // hasLiveSubscription — ใช้กันสมัครซ้ำ/พาไป portal
    assert.equal(b.hasLiveSubscription({ subscriptionId: 'sub_1', status: 'active' }), true);
    assert.equal(b.hasLiveSubscription({ subscriptionId: 'sub_1', status: 'past_due' }), true);
    assert.equal(b.hasLiveSubscription({ subscriptionId: 'sub_1', status: 'unpaid' }), true);
    assert.equal(b.hasLiveSubscription({ subscriptionId: 'sub_1', status: 'canceled' }), false);
    assert.equal(b.hasLiveSubscription({ customerId: 'cus_1' }), false, 'มีแค่ customer (บันทึกบัตร) ยังสมัครได้');

    // สิทธิ์: active ถึงสิ้นรอบ + 3 วัน
    const future = new Date(now + 10 * DAY);
    assert.equal(b.isSubscriptionEntitled({ status: 'active', currentPeriodEnd: future }, now), true);
    assert.equal(b.isSubscriptionEntitled({ status: 'active', currentPeriodEnd: new Date(now - 2 * DAY) }, now), true, 'grace');
    assert.equal(b.isSubscriptionEntitled({ status: 'active', currentPeriodEnd: new Date(now - 4 * DAY) }, now), false);
    assert.equal(b.isSubscriptionEntitled({ status: 'canceled', currentPeriodEnd: future }, now), false);
    assert.equal(b.isSubscriptionEntitled({ status: 'incomplete', currentPeriodEnd: future }, now), false);
    // Firestore Timestamp-like
    assert.equal(b.isSubscriptionEntitled({ status: 'active', currentPeriodEnd: { toMillis: () => now + DAY } }, now), true);

    // past_due: 3 วันนับจากเริ่มค้าง ไม่ใช่ทั้งรอบ
    assert.equal(b.isSubscriptionEntitled({ status: 'past_due', currentPeriodEnd: future, pastDueSince: new Date(now - 2 * DAY) }, now), true);
    assert.equal(b.isSubscriptionEntitled({ status: 'past_due', currentPeriodEnd: future, pastDueSince: new Date(now - 3 * DAY - 1) }, now), false);
    assert.equal(b.isSubscriptionEntitled({ status: 'past_due', currentPeriodEnd: future, paymentFailedAt: new Date(now - DAY) }, now), true, 'fallback paymentFailedAt');
    assert.equal(b.isSubscriptionEntitled({ status: 'past_due', currentPeriodEnd: future }, now), false, 'ไม่รู้วันเริ่ม = ไม่ให้');

    // pastDueSince: เริ่ม/คงเดิม/ล้าง
    assert.equal(b.nextPastDueSince('past_due', null, now), now);
    assert.equal(b.nextPastDueSince('past_due', now - DAY, now), now - DAY);
    assert.equal(b.nextPastDueSince('active', now - DAY, now), null);

    // periodOf อ่านจาก items (API ใหม่)
    const p = b.periodOf({ items: { data: [{ current_period_start: 1000, current_period_end: 2000 }] } } as any);
    assert.equal(p.start?.getTime(), 1000 * 1000);
    assert.equal(p.end?.getTime(), 2000 * 1000);
    assert.deepEqual(b.periodOf({ items: { data: [] } } as any), { start: null, end: null });

    assert.equal(b.idOf('x'), 'x');
    assert.equal(b.idOf({ id: 'y' }), 'y');
    assert.equal(b.idOf(null), null);

    console.log('capdeal-billing: all tests passed');
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
