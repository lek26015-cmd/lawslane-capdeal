import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { initAdmin } from '@/lib/firebase-admin';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
    const payload = await req.text();
    const signature = req.headers.get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            payload,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return NextResponse.json({ error: 'Webhook Error' }, { status: 400 });
    }

    // กัน replay: Stripe ส่ง event ซ้ำได้ตามปกติ (retry) และ event ที่เคยประมวลผลแล้ว
    // ต้องไม่ถูกทำซ้ำ — ใช้ create() ซึ่งจะ throw ถ้า document มีอยู่แล้ว
    try {
        const adminApp = await initAdmin();
        if (adminApp) {
            try {
                await adminApp.firestore().collection('stripe_events').doc(event.id).create({
                    type: event.type,
                    receivedAt: new Date(),
                });
            } catch {
                console.log(`Stripe event ${event.id} already processed — skipping`);
                return NextResponse.json({ received: true, duplicate: true });
            }
        }
    } catch (err) {
        console.error('Failed to record stripe event for idempotency', err);
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                if (session.mode === 'subscription' || session.mode === 'payment') {
                    await handleCheckoutSessionCompleted(session);
                }
                break;
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionUpdated(subscription);
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionDeleted(subscription);
                break;
            }
            default:
                // Unhandled event type
                break;
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Error handling webhook:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;
    const billingInterval = session.metadata?.billingInterval || 'month';
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!userId || !planId) {
        console.error('Missing metadata in checkout session');
        return;
    }

    // ต้องจ่ายเงินสำเร็จจริงก่อนถึงให้สิทธิ์แพลน
    // (โหมด subscription ที่เป็น trial จะเป็น 'no_payment_required' ซึ่งถือว่าผ่าน)
    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
        console.warn(`Checkout session ${session.id} is not paid (${session.payment_status}) — skipping`);
        return;
    }

    const adminApp = await initAdmin();
    if (!adminApp) return;
    const adminDb = adminApp.firestore();

    let currentPeriodEnd: Date;

    if (session.mode === 'subscription' && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);
    } else {
        // One-time payment (PromptPay)
        const now = new Date();
        if (billingInterval === 'year') {
            currentPeriodEnd = new Date(now.setFullYear(now.getFullYear() + 1));
        } else {
            currentPeriodEnd = new Date(now.setMonth(now.getMonth() + 1));
        }
    }

    const userRef = adminDb.collection('users').doc(userId);
    await userRef.set({
        subscription: {
            planId: planId,
            status: 'active', // ผ่านการตรวจ payment_status มาแล้วด้านบน
            currentPeriodEnd: currentPeriodEnd,
            customerId: customerId,
            subscriptionId: subscriptionId || null,
        }
    }, { merge: true });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    const adminApp = await initAdmin();
    if (!adminApp) return;
    const adminDb = adminApp.firestore();

    // Find user by customerId
    const usersSnapshot = await adminDb.collection('users')
        .where('subscription.customerId', '==', customerId)
        .limit(1)
        .get();

    if (usersSnapshot.empty) {
        console.error('User not found for customer ID:', customerId);
        return;
    }

    const userDoc = usersSnapshot.docs[0];
    const currentPlanId = userDoc.data().subscription?.planId;

    await userDoc.ref.set({
        subscription: {
            status: subscription.status,
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
            subscriptionId: subscription.id,
            planId: currentPlanId // Keep existing plan ID or extract from subscription items if changed
        }
    }, { merge: true });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    const adminApp = await initAdmin();
    if (!adminApp) return;
    const adminDb = adminApp.firestore();

    const usersSnapshot = await adminDb.collection('users')
        .where('subscription.customerId', '==', customerId)
        .limit(1)
        .get();

    if (usersSnapshot.empty) return;

    const userDoc = usersSnapshot.docs[0];

    await userDoc.ref.set({
        subscription: {
            status: 'canceled',
        }
    }, { merge: true });
}
