import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { SUBSCRIPTION_PLANS, PlanId } from '@/lib/subscription';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { planId, userId, customerEmail, billingInterval } = body;

        if (!planId || !userId) {
            return NextResponse.json({ error: 'Plan ID and User ID are required' }, { status: 400 });
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

        const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const sk = process.env.STRIPE_SECRET_KEY || '';
        console.log('Stripe Key Check:', {
            length: sk.length,
            prefix: sk.substring(0, 10),
            suffix: sk.substring(sk.length - 4)
        });

        const mode = 'subscription'; // Force subscription for all plans for now, or revert to conditional if needed
        const paymentMethods = mode === 'subscription' ? ['card'] : ['card', 'promptpay'];

        console.log('Creating Stripe embedded session for:', { planId, userId, customerEmail, billingInterval, priceId });

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
