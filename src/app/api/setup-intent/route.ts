import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { initAdmin } from '@/lib/firebase-admin';

export async function POST(req: Request) {
    try {
        const { userId, email } = await req.json();

        if (!userId || !email) {
            return new NextResponse('User ID and email are required', { status: 400 });
        }

        const adminApp = await initAdmin();
        if (!adminApp) {
            return new NextResponse('Firebase Admin not initialized', { status: 500 });
        }
        const adminDb = adminApp.firestore();
        const userDoc = await adminDb.collection('users').doc(userId).get();
        const userData = userDoc.data();

        let customerId = userData?.subscription?.customerId;

        // If user doesn't have a Stripe customer yet, create one
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: email,
                metadata: { firebaseUserId: userId },
            });
            customerId = customer.id;

            // Save Stripe customerId to Firebase
            await adminDb.collection('users').doc(userId).set({
                subscription: {
                    customerId: customerId,
                },
            }, { merge: true });
        }

        // Create a Checkout Session in "setup" mode to collect payment method
        const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'setup',
            customer: customerId,
            success_url: `${origin}/account?setup=success`,
            cancel_url: `${origin}/account?setup=cancelled`,
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('STRIPE_SETUP_INTENT_ERROR', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
