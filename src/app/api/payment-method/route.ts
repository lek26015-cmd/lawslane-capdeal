import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { initAdmin } from '@/lib/firebase-admin';

/**
 * Fetch the user's default payment method from Stripe
 */
export async function POST(req: Request) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ paymentMethod: null });
        }

        const adminApp = await initAdmin();
        if (!adminApp) {
            return NextResponse.json({ paymentMethod: null });
        }

        const adminDb = adminApp.firestore();
        const userDoc = await adminDb.collection('users').doc(userId).get();
        const userData = userDoc.data();

        const customerId = userData?.subscription?.customerId;
        if (!customerId) {
            return NextResponse.json({ paymentMethod: null });
        }

        // Fetch payment methods from Stripe
        const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: 'card',
            limit: 1,
        });

        if (paymentMethods.data.length === 0) {
            return NextResponse.json({ paymentMethod: null });
        }

        const pm = paymentMethods.data[0];
        return NextResponse.json({
            paymentMethod: {
                brand: pm.card?.brand || 'card',
                last4: pm.card?.last4 || '****',
                expMonth: pm.card?.exp_month || 0,
                expYear: pm.card?.exp_year || 0,
            },
        });
    } catch (error: any) {
        console.error('PAYMENT_METHOD_ERROR', error);
        return NextResponse.json({ paymentMethod: null });
    }
}
