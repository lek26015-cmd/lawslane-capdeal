import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { requireUser, authErrorResponse } from '@/lib/auth-guard';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
        return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // เดิมไม่ตรวจอะไรเลย → มี session_id ก็ดึงอีเมลผู้ซื้อได้
    let uid: string;
    try {
        ({ uid } = await requireUser());
    } catch (e) {
        return authErrorResponse(e);
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        // session ต้องเป็นของผู้เรียกเอง (checkout ฝัง metadata.userId จาก token)
        if (session.metadata?.userId !== uid) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json({
            status: session.status,
            customer_email: session.customer_details?.email
        });
    } catch (err: any) {
        console.error('Error retrieving Stripe session:', err);
        return NextResponse.json({ error: 'Failed to retrieve session' }, { status: 500 });
    }
}
