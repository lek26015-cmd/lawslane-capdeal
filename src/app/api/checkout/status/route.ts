import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { requireUser, authErrorResponse } from '@/lib/auth-guard';

/**
 * สถานะ Checkout ของผู้เรียกเอง — ใช้แสดงผลที่หน้า checkout/return เท่านั้น ไม่ให้สิทธิ์อะไร
 * (สิทธิ์มาจาก webhook) และไม่คืนอีเมล/ข้อมูลส่วนตัว
 */
export async function GET(req: NextRequest) {
    const sessionId = req.nextUrl.searchParams.get('session_id');
    if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
        return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    let uid: string;
    try {
        ({ uid } = await requireUser());
    } catch (e) {
        return authErrorResponse(e);
    }

    try {
        const session = await getStripe().checkout.sessions.retrieve(sessionId);

        // session ต้องเป็นของผู้เรียกเอง (checkout ฝัง metadata.uid จาก token)
        if (session.metadata?.uid !== uid) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json({
            status: session.status,
            paymentStatus: session.payment_status,
            planId: session.metadata?.planId ?? null,
        });
    } catch (err: any) {
        console.error('Error retrieving Stripe session:', err?.code ?? '', err?.message ?? 'unknown');
        return NextResponse.json({ error: 'Failed to retrieve session' }, { status: 500 });
    }
}
