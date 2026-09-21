import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { SUBSCRIPTION_PLANS, PlanId } from '@/lib/subscription';
import { requireUser, authErrorResponse, safeOrigin } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { planId, billingInterval } = body;

        // userId/customerEmail ต้องมาจาก session ที่ตรวจแล้ว — เดิมรับจาก body
        // แล้วใส่ลง metadata.userId ซึ่ง webhook เอาไปให้สิทธิ์แพลนตาม uid นั้น
        let userId: string;
        let customerEmail: string | undefined;
        try {
            const session = await requireUser();
            userId = session.uid;
            customerEmail = session.token.email;
        } catch (e) {
            return authErrorResponse(e);
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
            return_url: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
            metadata: {
                userId: userId,
                planId: planId,
                billingInterval: billingInterval || 'month',
            },
        };

        // Only add customer_email if it's a valid non-empty string
        if (customerEmail && typeof customerEmail === 'string' && customerEmail.trim() !== '') {
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
