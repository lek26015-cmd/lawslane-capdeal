import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { initAdmin } from '@/lib/firebase-admin';

export async function POST(req: Request) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return new NextResponse('User ID is required', { status: 400 });
        }

        const adminApp = await initAdmin();
        if (!adminApp) {
            return new NextResponse('Firebase Admin not initialized', { status: 500 });
        }
        const adminDb = adminApp.firestore();
        const userDoc = await adminDb.collection('users').doc(userId).get();
        const userData = userDoc.data();

        if (!userData || !userData.subscription || !userData.subscription.customerId) {
            return new NextResponse('Customer not found', { status: 404 });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: userData.subscription.customerId,
            return_url: `${req.headers.get('origin')}/account`,
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('STRIEP_PORTAL_ERROR', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
