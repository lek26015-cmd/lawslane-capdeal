import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
        return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        return NextResponse.json({
            status: session.status,
            customer_email: session.customer_details?.email
        });
    } catch (err: any) {
        console.error('Error retrieving Stripe session:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
