import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { SUBSCRIPTION_PLANS, PlanId } from '@/lib/subscription';
import { requireUser, authErrorResponse, safeOrigin } from '@/lib/auth-guard';
import { isSubscriptionEntitled } from '@/lib/entitlement';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { planId, billingInterval } = body;

        // userId/customerEmail ต้องมาจาก session ที่ตรวจแล้ว — เดิมรับจาก body
        // แล้วใส่ลง metadata.userId ซึ่ง webhook เอาไปให้สิทธิ์แพลนตาม uid นั้น
        let userId: string;
        let customerEmail: string | undefined;
        let adminApp;
        try {
            const session = await requireUser();
            userId = session.uid;
            customerEmail = session.token.email;
            adminApp = session.adminApp;
        } catch (e) {
            return authErrorResponse(e);
        }

        // มีแพ็กเกจที่ยังใช้งานอยู่แล้ว → ต้องเปลี่ยนผ่าน Billing Portal
        // เดิมซื้อซ้ำได้ → 2 subscription ตัวแรกหลุดจากบัญชี ยกเลิกเองไม่ได้แต่ยังโดนตัดเงิน
        const existing = (await adminApp.firestore().collection('users').doc(userId).get()).data()?.subscription;
        if (existing?.subscriptionId && isSubscriptionEntitled(existing)) {
            return NextResponse.json({
                error: 'คุณมีแพ็กเกจที่ใช้งานอยู่แล้ว กรุณาเปลี่ยนหรือยกเลิกแพ็กเกจที่หน้า "บัญชีของฉัน"',
                code: 'already_subscribed',
            }, { status: 409 });
        }

        if (!planId) {
            return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
        }

        const plan = SUBSCRIPTION_PLANS[planId as PlanId];
        if (!plan || !plan.stripePriceId) {
            return NextResponse.json({ error: 'Invalid plan or missing price ID' }, { status: 400 });
        }

        const isYearly = billingInterval === 'year';
        const priceId = isYearly ? plan.stripeYearlyPriceId : plan.stripePriceId;

        if (!priceId) {
            return NextResponse.json({ error: `Missing Stripe Price ID for ${billingInterval} interval on plan ${plan.name}` }, { status: 400 });
        }

        const origin = safeOrigin(req.headers.get('origin'));

        const mode = 'subscription'; // Force subscription for all plans for now, or revert to conditional if needed
        const paymentMethods = mode === 'subscription' ? ['card'] : ['card', 'promptpay'];

        console.log('Creating Stripe embedded session for:', { planId, billingInterval, priceId });

        const sessionParams: any = {
            ui_mode: 'embedded',
            payment_method_types: paymentMethods as any,
            billing_address_collection: 'auto',
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: mode as any,
            return_url: `${origin}/${body.locale === 'en' || body.locale === 'zh' ? body.locale : 'th'}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
            metadata: {
                userId: userId,
                planId: planId,
                billingInterval: billingInterval || 'month',
            },
            // ให้ event ของ subscription หา user เจอแม้ customerId ในบัญชีเปลี่ยน
            subscription_data: {
                metadata: { userId, planId },
            },
        };

        // ใช้ Stripe customer เดิมของผู้ใช้ (จากการซื้อครั้งก่อน / บันทึกบัตรไว้)
        // เดิมสร้าง customer ใหม่ทุกครั้ง บัตรที่บันทึกไว้จึงไปอยู่คนละ customer
        if (existing?.customerId) {
            sessionParams.customer = existing.customerId;
        } else if (customerEmail && typeof customerEmail === 'string' && customerEmail.trim() !== '') {
            sessionParams.customer_email = customerEmail;
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        return NextResponse.json({ clientSecret: session.client_secret });
    } catch (error: any) {
        console.error('Stripe checkout error:', error);
        // Provide more detailed error message if available
        const message = error.raw?.message || error.message || 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
