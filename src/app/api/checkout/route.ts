import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { SUBSCRIPTION_PLANS, PlanId } from '@/lib/subscription';
import { requireUser, authErrorResponse, safeOrigin } from '@/lib/auth-guard';
import { hasLiveSubscription } from '@/lib/entitlement';
import { CAPDEAL_PRODUCT } from '@/lib/capdeal-billing';
import { consumeRateLimit } from '@/lib/rate-limit';

/**
 * สร้าง Stripe Checkout (หน้าที่ Stripe โฮสต์) สำหรับแพลน CapDeal แล้วคืน URL ให้ browser redirect
 *
 * - ใช้ Checkout ที่ Stripe โฮสต์เท่านั้น (PCI SAQ A) — เลิก embedded + client secret
 * - client ส่งได้แค่ planId/billingInterval/locale ราคาหาเองจาก Price ID ฝั่ง server
 * - ไม่ระบุ payment_method_types → ใช้ dynamic payment methods ตามที่เปิดใน Dashboard
 * - metadata ใส่ได้แค่ product/uid/planId/billingInterval (ห้ามชื่อ/อีเมล/เบอร์)
 * - กันสมัครซ้ำ: มี subscription ที่ยังไม่จบ → 409 ไปที่ Billing Portal · มี Checkout ที่ยัง open
 *   ของแพลนเดียวกัน → ใช้อันเดิม (แพลนอื่นให้ expire ทิ้ง จะได้จ่ายซ้อนไม่ได้)
 * - จำกัด 5 ครั้ง / 10 นาที / ผู้ใช้ (กัน card testing)
 */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const LOCALES = new Set(['th', 'en', 'zh']);

export async function POST(req: NextRequest) {
    // uid/อีเมลต้องมาจาก session ที่ตรวจแล้ว — ห้ามรับจาก body
    let session;
    try {
        session = await requireUser();
    } catch (e) {
        return authErrorResponse(e);
    }
    const { uid, adminApp } = session;
    const customerEmail = session.token.email;
    const db = adminApp.firestore();

    try {
        const body = await req.json().catch(() => ({}));
        const planId = typeof body.planId === 'string' ? body.planId : '';
        const billingInterval: 'month' | 'year' = body.billingInterval === 'year' ? 'year' : 'month';
        const locale = LOCALES.has(body.locale) ? body.locale : 'th';

        const plan = SUBSCRIPTION_PLANS[planId as PlanId];
        if (!plan || plan.id === 'free') {
            return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
        }
        const priceId = billingInterval === 'year' ? plan.stripeYearlyPriceId : plan.stripePriceId;
        if (!priceId) {
            console.error(`Checkout: missing Stripe price for ${plan.id}/${billingInterval}`);
            return NextResponse.json({ error: 'แพ็กเกจนี้ยังไม่เปิดขาย กรุณาลองใหม่ภายหลัง' }, { status: 400 });
        }

        if (!(await consumeRateLimit(db, `capdeal_checkout_${uid}`, RATE_LIMIT, RATE_WINDOW_MS))) {
            return NextResponse.json({ error: 'ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่', code: 'rate_limited' }, { status: 429 });
        }

        // มี subscription ที่ยังไม่จบ (รวมค้างชำระ) → เปลี่ยน/แก้บัตรผ่าน Billing Portal
        // เดิมซื้อซ้ำได้ → 2 subscription ตัวแรกหลุดจากบัญชี ยกเลิกเองไม่ได้แต่ยังโดนตัดเงิน
        const userRef = db.collection('users').doc(uid);
        const existing = (await userRef.get()).data()?.subscription;
        if (hasLiveSubscription(existing)) {
            return NextResponse.json({
                error: 'คุณมีแพ็กเกจที่ใช้งานอยู่แล้ว กรุณาเปลี่ยนหรือยกเลิกแพ็กเกจที่หน้า "บัญชีของฉัน"',
                code: 'already_subscribed',
            }, { status: 409 });
        }

        const stripe = getStripe();

        // Stripe customer ต่อผู้ใช้หนึ่งคน — ต้องมีก่อนจะได้หา Checkout ที่ยัง open ของคนนี้ได้
        let customerId: string | undefined = existing?.customerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: customerEmail || undefined,
                metadata: { product: CAPDEAL_PRODUCT, uid },
            }, { idempotencyKey: `capdeal-customer-${uid}` });
            customerId = customer.id;
            await userRef.set({ subscription: { customerId } }, { merge: true });
        }

        const successUrl = `${safeOrigin(req.headers.get('origin'))}/${locale}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${safeOrigin(req.headers.get('origin'))}/${locale}/pricing`;

        // ใช้ Checkout ที่ยัง open อยู่ถ้าเป็นแพลน/รอบเดียวกัน · คนละแพลนให้ expire ทิ้ง
        const open = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 10 });
        for (const s of open.data) {
            if (s.metadata?.product !== CAPDEAL_PRODUCT) continue;
            if (s.metadata?.planId === plan.id && s.metadata?.billingInterval === billingInterval && s.url) {
                return NextResponse.json({ url: s.url });
            }
            await stripe.checkout.sessions.expire(s.id).catch((e: any) =>
                console.warn(`Checkout: could not expire ${s.id}: ${e?.code ?? 'unknown'}`));
        }

        const metadata = { product: CAPDEAL_PRODUCT, uid, planId: plan.id, billingInterval };
        const params: Stripe.Checkout.SessionCreateParams = {
            mode: 'subscription',
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            billing_address_collection: 'auto',
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata,
            // ให้ event ของ subscription รู้ว่าเป็นของ CapDeal และของใคร
            subscription_data: { metadata: { product: CAPDEAL_PRODUCT, uid, planId: plan.id } },
        };

        // กดซ้ำ/เปิด 2 แท็บพร้อมกันในช่วง 10 นาทีเดียวกัน → ได้ session เดิม
        // ใส่ id ของ session ที่ open อยู่ลงใน key ด้วย — เลือกแพลนเดิมอีกครั้งหลังจาก expire ไปแล้ว
        // จะได้ไม่ได้ session ที่ถูก expire กลับมา
        const bucket = Math.floor(Date.now() / RATE_WINDOW_MS);
        const seen = open.data.map((s) => s.id).sort().join(',');
        const keyHash = createHash('sha256').update(`${priceId}|${locale}|${bucket}|${seen}`).digest('hex').slice(0, 32);
        const checkout = await stripe.checkout.sessions.create(params, {
            idempotencyKey: `capdeal-checkout-${uid}-${keyHash}`,
        });
        if (!checkout.url) throw new Error('Checkout session has no url');

        return NextResponse.json({ url: checkout.url });
    } catch (error: any) {
        // ไม่ส่งข้อความภายใน/ของ Stripe กลับไปที่ browser
        console.error('Stripe checkout error:', error?.type ?? '', error?.code ?? '', error?.message ?? 'unknown');
        return NextResponse.json({ error: 'ไม่สามารถเริ่มการชำระเงินได้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
    }
}
