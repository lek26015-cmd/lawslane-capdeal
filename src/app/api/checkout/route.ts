import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { SUBSCRIPTION_PLANS, PlanId } from '@/lib/subscription';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { planId, userId, customerEmail } = body;

        if (!planId || !userId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const plan = SUBSCRIPTION_PLANS[planId as PlanId];
        if (!plan || !plan.stripePriceId) {
            return NextResponse.json({ error: 'Invalid plan or missing price ID' }, { status: 400 });
        }

        const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'promptpay'],
            billing_address_collection: 'auto',
            customer_email: customerEmail,
            line_items: [
                {
                    price: plan.stripePriceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/pricing`,
            metadata: {
                userId: userId,
                planId: planId,
            },
            // Optionally link an existing customer if you track customerIds in Firebase
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('Stripe checkout error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
