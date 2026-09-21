import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { initAdmin } from '@/lib/firebase-admin';
import { requireUser, authErrorResponse, safeOrigin } from '@/lib/auth-guard';

export async function POST(req: Request) {
    // เดิมรับ { userId, email } จาก body → สร้าง Stripe customer แล้วเขียนทับ
    // users/{userId}.subscription.customerId ของคนอื่นได้
    // uid และอีเมลต้องมาจาก token ที่ตรวจแล้วเท่านั้น
    let userId: string;
    let email: string | undefined;
    try {
        const session = await requireUser();
        userId = session.uid;
        email = session.token.email;
    } catch (e) {
        return authErrorResponse(e);
    }

    if (!email) {
        return new NextResponse('Account has no email address', { status: 400 });
    }

    try {

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
        const origin = safeOrigin(req.headers.get('origin'));

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
