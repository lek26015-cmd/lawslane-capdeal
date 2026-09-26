import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';
import { requireUser } from '@/lib/auth-guard';
import {
    ContractError,
    SIGN_ROLES,
    SignRole,
    assertShareAccess,
    assertValidSignature,
    contractErrorResponse,
    contractTermsHash,
    isCapdealContract,
    verifyPhoneIdToken,
} from '@/lib/contract-server';

/**
 * เซ็นสัญญา — ทำฝั่ง server เท่านั้น
 *
 * สิทธิ์เซ็นมาได้ 2 ทาง: เป็นเจ้าของสัญญา (session) หรือถือลิงก์แชร์ (token + PIN)
 * ทุกการเซ็นต้องผ่าน OTP เบอร์โทร ซึ่ง server ตรวจเองจาก phone ID token
 *
 * กติกา:
 *  - ฝ่ายที่เซ็นแล้วเซ็นทับไม่ได้ / สัญญาที่เซ็นครบหรือยกเลิกแล้วเซ็นไม่ได้
 *  - เบอร์เดียวกันหรือบัญชีเดียวกันเซ็นทั้งสองฝ่ายไม่ได้
 *  - เก็บ hash ของเงื่อนไขสัญญากับลายเซ็น ถ้าเนื้อหาเปลี่ยนหลังฝ่ายแรกเซ็น ฝ่ายที่สองจะเซ็นไม่ได้
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const role = body?.role as SignRole;

    const adminApp = await initAdmin();
    if (!adminApp) {
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    try {
        if (!SIGN_ROLES.includes(role)) {
            throw new ContractError('bad_role', 'ไม่ทราบว่าเซ็นในฐานะฝ่ายใด', 400);
        }
        assertValidSignature(body?.signature);
        const signature: string = body.signature;

        const { phoneNumber, phoneUid } = await verifyPhoneIdToken(adminApp.auth(), body?.phoneIdToken);

        let sessionUid: string | null = null;
        try {
            sessionUid = (await requireUser()).uid;
        } catch {
            // ไม่ได้ล็อกอิน — ต้องใช้ลิงก์แชร์
        }

        const db = adminApp.firestore();
        const ref = db.collection('contracts').doc(id);

        const firstSnap = await ref.get();
        const firstData = firstSnap.data();
        if (!firstSnap.exists || !firstData || !isCapdealContract(firstData)) {
            throw new ContractError('not_found', 'ไม่พบสัญญา', 404);
        }

        const isOwner = sessionUid !== null && firstData.ownerId === sessionUid;
        if (!isOwner) {
            await assertShareAccess(ref, firstData, body?.token, body?.pin);
        }

        const hdrs = await headers();
        const signerIp = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
        const signerUserAgent = hdrs.get('user-agent')?.slice(0, 300) || null;

        const result = await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const data = snap.data();
            if (!data || !isCapdealContract(data)) {
                throw new ContractError('not_found', 'ไม่พบสัญญา', 404);
            }
            if (['signed', 'completed', 'canceled'].includes(data.status)) {
                throw new ContractError('closed', 'สัญญานี้เซ็นครบหรือถูกยกเลิกแล้ว', 409);
            }

            const me = data[role];
            if (me?.signature) {
                throw new ContractError('already_signed', 'ฝ่ายนี้เซ็นไปแล้ว', 409);
            }

            const otherRole: SignRole = role === 'employer' ? 'contractor' : 'employer';
            const other = data[otherRole] ?? {};
            const termsHash = contractTermsHash(data);

            if (other.signature) {
                if (other.verifiedPhoneNumber === phoneNumber) {
                    throw new ContractError('same_signer', 'เบอร์นี้เซ็นอีกฝ่ายไปแล้ว — คู่สัญญาแต่ละฝ่ายต้องใช้เบอร์ของตัวเอง', 409);
                }
                if (sessionUid && other.signerUid === sessionUid) {
                    throw new ContractError('same_signer', 'บัญชีนี้เซ็นอีกฝ่ายไปแล้ว — ส่งลิงก์ให้คู่สัญญาเซ็นเอง', 409);
                }
                if (other.termsHash && other.termsHash !== termsHash) {
                    throw new ContractError('terms_changed', 'เนื้อหาสัญญาถูกแก้หลังอีกฝ่ายเซ็น กรุณาสร้างฉบับแก้ไขใหม่', 409);
                }
            }

            const now = FieldValue.serverTimestamp();
            const updates: Record<string, unknown> = {
                [`${role}.signature`]: signature,
                [`${role}.signedAt`]: now,
                [`${role}.verifiedPhoneNumber`]: phoneNumber,
                [`${role}.otpVerificationTimestamp`]: now,
                [`${role}.authUid`]: phoneUid,
                [`${role}.signerUid`]: sessionUid,
                [`${role}.signedVia`]: isOwner ? 'owner' : 'share_link',
                [`${role}.signerIp`]: signerIp,
                [`${role}.signerUserAgent`]: signerUserAgent,
                [`${role}.termsHash`]: termsHash,
                updatedAt: now,
            };

            const bothSigned = Boolean(other.signature);
            if (bothSigned) {
                updates.status = 'signed';
                updates.signedAt = now;
                updates.signedTermsHash = termsHash;
            } else if (data.status === 'draft') {
                updates.status = 'pending';
            }

            tx.update(ref, updates);
            return { status: bothSigned ? 'signed' : 'pending' };
        });

        return NextResponse.json({ ok: true, ...result });
    } catch (error) {
        const res = contractErrorResponse(error);
        if (res) return res;
        console.error('CONTRACT_SIGN_ERROR', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
