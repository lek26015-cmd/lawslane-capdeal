import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireUser, authErrorResponse } from '@/lib/auth-guard';
import { hashPin, newShareToken } from '@/lib/contract-server';

/**
 * เจ้าของสัญญาสร้าง/รีเซ็ตลิงก์แชร์
 * ทุกครั้งที่เรียกจะออก token ใหม่ ลิงก์เก่าใช้ไม่ได้ทันที (ใช้เป็นการยกเลิกลิงก์ได้ด้วย)
 * PIN เก็บเป็น scrypt hash — ลบ `sharePin` แบบ plaintext ของเดิมทิ้ง
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    let session;
    try {
        session = await requireUser();
    } catch (e) {
        return authErrorResponse(e);
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const isPinProtected = body?.isPinProtected === true;
    const pin = body?.pin;

    if (isPinProtected && (typeof pin !== 'string' || !/^\d{4}$/.test(pin))) {
        return NextResponse.json({ error: 'PIN ต้องเป็นตัวเลข 4 หลัก' }, { status: 400 });
    }

    const ref = session.adminApp.firestore().collection('contracts').doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.ownerId !== session.uid) {
        return NextResponse.json({ error: 'ไม่พบสัญญา' }, { status: 404 });
    }

    const shareToken = newShareToken();
    await ref.update({
        shareToken,
        isPinProtected,
        sharePinHash: isPinProtected ? hashPin(pin) : FieldValue.delete(),
        sharePin: FieldValue.delete(),
        shareFailedAttempts: 0,
        shareLockedUntil: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ path: `/shared/contract/${id}?t=${shareToken}` });
}
