import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';
import {
    assertShareAccess,
    contractErrorResponse,
    isCapdealContract,
    toSharedView,
} from '@/lib/contract-server';

/**
 * คู่สัญญาเปิดดูสัญญาผ่านลิงก์แชร์ (ไม่ต้องล็อกอิน)
 * เดิมหน้าแชร์อ่าน Firestore ตรงจาก client ซึ่ง prod rules ปฏิเสธ → เปิดไม่ได้เลย
 * ใช้ POST เพื่อไม่ให้ PIN ไปอยู่ใน URL / access log
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const adminApp = await initAdmin();
    if (!adminApp) {
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    try {
        const ref = adminApp.firestore().collection('contracts').doc(id);
        const snap = await ref.get();
        const data = snap.data();
        if (!snap.exists || !data || !isCapdealContract(data)) {
            return NextResponse.json({ error: 'ไม่พบสัญญา หรือลิงก์ถูกยกเลิกแล้ว', code: 'not_found' }, { status: 404 });
        }

        await assertShareAccess(ref, data, body?.token, body?.pin);

        return NextResponse.json(
            { contract: await toSharedView(id, data) },
            { headers: { 'Cache-Control': 'private, no-store' } },
        );
    } catch (error) {
        const res = contractErrorResponse(error);
        if (res) return res;
        console.error('SHARED_CONTRACT_VIEW_ERROR', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
