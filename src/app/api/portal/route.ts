import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { initAdmin } from '@/lib/firebase-admin';
import { requireUser, authErrorResponse, safeOrigin } from '@/lib/auth-guard';

export async function POST(req: Request) {
    // uid ต้องมาจาก session ที่ตรวจแล้วเท่านั้น
    // เดิมรับ { userId } จาก body → รู้ uid ของใครก็เปิด Stripe billing portal ของคนนั้นได้
    let userId: string;
    try {
        ({ uid: userId } = await requireUser());
    } catch (e) {
        return authErrorResponse(e);
    }

    try {

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

        // configuration แยกต่อผลิตภัณฑ์ (PLAN-08 เฟส 1) — ไม่ตั้ง env = ใช้ค่าเริ่มต้นของบัญชี
        const configuration = process.env.STRIPE_PORTAL_CONFIG_CAPDEAL || undefined;
        const session = await getStripe().billingPortal.sessions.create({
            customer: userData.subscription.customerId,
            return_url: `${safeOrigin(req.headers.get('origin'))}/account`,
            ...(configuration ? { configuration } : {}),
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('STRIPE_PORTAL_ERROR', error?.code ?? '', error?.message ?? 'unknown');
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
