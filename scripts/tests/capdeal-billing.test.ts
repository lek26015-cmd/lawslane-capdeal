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
process.env.STRIPE_PORTAL_CONFIG_CAPDEAL = 'bpc_env';

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

    const pp = await import('../../src/lib/plan-pricing-core');
    const defaults = pp.defaultCapdealPricing();

    // Price → แพลน: รู้จักเท่านั้น ห้ามเดา (ไม่มีเอกสาร planPricing = env เหมือนเฟส 1)
    assert.equal(b.planIdForPriceId('price_lite_m', defaults), 'lite');
    assert.equal(b.planIdForPriceId('price_pro_y', defaults), 'pro');
    assert.equal(b.planIdForPriceId('price_scale_m', defaults), 'scale');
    assert.equal(b.planIdForPriceId('price_unknown', defaults), null);
    assert.equal(b.planIdForPriceId('', defaults), null, 'env ว่างต้องไม่จับคู่กับ price ว่าง');
    assert.equal(b.planIdForPriceId(null, defaults), null);
    assert.equal(b.resolvePlanFromPrice('price_pro_m', defaults), 'pro');

    // ---- ราคากลาง planPricing/capdeal (PLAN-08 เฟส 2) ----
    // ไม่มีเอกสาร = ราคาในโค้ด + env (เว็บต้องเหมือนเดิมทุกอย่าง)
    assert.equal(defaults.source, 'default');
    assert.deepEqual(pp.publicAmounts(defaults), {
        lite: { monthly: 159, yearly: 1590 },
        pro: { monthly: 249, yearly: 2490 },
        scale: { monthly: 1049, yearly: 10490 },
    });
    assert.deepEqual(pp.publicAmounts(defaults), pp.defaultPublicAmounts(), 'ค่าเริ่มต้นฝั่ง browser ตรงกับ server');
    assert.deepEqual(pp.mergeCapdealPricing(null), defaults);
    assert.deepEqual(pp.mergeCapdealPricing(undefined), defaults);
    assert.equal(pp.checkoutPriceIdFor(defaults, 'lite', 'month'), 'price_lite_m');
    assert.equal(pp.checkoutPriceIdFor(defaults, 'pro', 'year'), 'price_pro_y');
    assert.equal(pp.checkoutPriceIdFor(defaults, 'scale', 'year'), null, 'env ว่าง = ยังไม่เปิดขาย');
    assert.equal(pp.checkoutPriceIdFor(defaults, 'free', 'month'), null);
    assert.equal(pp.checkoutPriceIdFor(defaults, 'enterprise', 'month'), null);
    assert.equal(defaults.portalConfigId, 'bpc_env');

    // มีเอกสาร: ราคา/Price ปัจจุบันจาก Firestore, Price เก่า + env ยังรู้จัก
    const doc = {
        currency: 'thb',
        plans: {
            pro: {
                monthly: 299, yearly: null,
                stripe: {
                    productId: 'prod_pro', monthlyPriceId: 'price_pro_m_v2', yearlyPriceId: null,
                    previousPriceIds: ['price_pro_m_v1', 42, ''],
                },
            },
            lite: { monthly: 'abc', yearly: 1990.5 }, // ชนิดผิด → ค่าเริ่มต้น
            free: { monthly: 99 }, // planId ที่ไม่ขายผ่าน Stripe ไม่ถูกใช้
        },
        portalConfigId: 'bpc_fs',
        updatedAt: '2026-10-12T00:00:00Z', updatedBy: 'uid_admin',
    };
    const merged = pp.mergeCapdealPricing(doc);
    assert.equal(merged.source, 'firestore');
    assert.deepEqual(pp.publicAmounts(merged), {
        lite: { monthly: 159, yearly: 1590 },
        pro: { monthly: 299, yearly: null },
        scale: { monthly: 1049, yearly: 10490 },
    });
    assert.equal(pp.checkoutPriceIdFor(merged, 'pro', 'month'), 'price_pro_m_v2', 'Firestore ก่อน env');
    assert.equal(pp.checkoutPriceIdFor(merged, 'pro', 'year'), null, 'yearly = null → ไม่ขาย แม้ env มี Price');
    assert.equal(pp.checkoutPriceIdFor(merged, 'lite', 'month'), 'price_lite_m', 'ไม่มี stripe ใน Firestore → env');
    assert.equal(b.planIdForPriceId('price_pro_m_v2', merged), 'pro', 'Price ปัจจุบัน');
    assert.equal(b.planIdForPriceId('price_pro_m_v1', merged), 'pro', 'Price เก่า (previousPriceIds) ยังจับคู่ได้');
    assert.equal(b.planIdForPriceId('price_pro_m', merged), 'pro', 'Price ใน env ยังจับคู่ได้');
    assert.equal(b.planIdForPriceId('price_pro_y', merged), 'pro', 'รายปีเลิกขายแล้วแต่ลูกค้าเดิมยังได้แพลน');
    assert.equal(b.planIdForPriceId('price_lite_y', merged), 'lite');
    assert.equal(b.planIdForPriceId('42', merged), null, 'previousPriceIds ชนิดผิดไม่ถูกนับ');
    assert.equal(b.planIdForPriceId('price_unknown', merged), null, 'ไม่รู้จัก = ไม่ให้แพลน');
    assert.equal(merged.portalConfigId, 'bpc_fs', 'portal: Firestore ก่อน env');
    assert.equal(pp.mergeCapdealPricing({ plans: {}, portalConfigId: null }).portalConfigId, 'bpc_env', 'portal: ไม่มีใน Firestore → env');
    // monthly = null = ไม่ขาย
    const notSold = pp.mergeCapdealPricing({ plans: { scale: { monthly: null, yearly: null } } });
    assert.equal(pp.checkoutPriceIdFor(notSold, 'scale', 'month'), null);
    assert.equal(b.planIdForPriceId('price_scale_m', notSold), 'scale', 'เลิกขายแล้ว subscription เดิมยังได้แพลน');
    // สกุลเงินผิด → ไม่ใช้ทั้งเอกสาร
    const origError = console.error;
    console.error = () => {};
    try {
        assert.deepEqual(pp.mergeCapdealPricing({ currency: 'usd', plans: { pro: { monthly: 1 } } }), defaults);

        // ตัวโหลด: แคป 60 วินาที, อ่านไม่ได้ → ค่าเริ่มต้น (ไม่ throw)
        let t = 0;
        let calls = 0;
        let fail = false;
        const loader = pp.createPricingLoader(async () => {
            calls++;
            if (fail) throw Object.assign(new Error('unavailable'), { code: 14 });
            return doc;
        }, { now: () => t });
        const [a1, a2] = await Promise.all([loader.get(), loader.get()]);
        assert.equal(calls, 1, 'request พร้อมกันอ่านครั้งเดียว');
        assert.equal(a1, a2);
        assert.equal(a1.plans.pro.monthly, 299);
        t = 59_000;
        await loader.get();
        assert.equal(calls, 1, 'ยังอยู่ในแคป');
        t = 60_001;
        fail = true;
        const fallback = await loader.get();
        assert.equal(calls, 2);
        assert.deepEqual(fallback, defaults, 'Firestore พัง → ค่าเริ่มต้น');
        assert.equal(pp.checkoutPriceIdFor(fallback, 'pro', 'month'), 'price_pro_m');
        t = 70_000;
        await loader.get();
        assert.equal(calls, 2, 'ผลสำรองแคปสั้น ๆ ไม่ยิงซ้ำทุก request');
        t = 76_000;
        fail = false;
        assert.equal((await loader.get()).plans.pro.monthly, 299, 'หายพังแล้วกลับมาใช้ Firestore');
        assert.equal(calls, 3);
        // ไม่มีเอกสาร → ค่าเริ่มต้น
        const empty = pp.createPricingLoader(async () => null);
        assert.deepEqual(await empty.get(), defaults);
    } finally {
        console.error = origError;
    }

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
