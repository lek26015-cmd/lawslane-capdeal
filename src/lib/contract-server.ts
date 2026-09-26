import 'server-only';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2 } from '@/lib/r2';

/**
 * ตรรกะสัญญาฝั่ง server — การแชร์ / เปิดดูผ่านลิงก์ / เซ็น ทำผ่าน Admin SDK ที่นี่ทั้งหมด
 *
 * เดิมทำจาก client ทั้งหมด:
 *  - หน้าแชร์อ่าน `contracts` ตรงจากเบราว์เซอร์ แต่ prod rules ให้อ่านได้เฉพาะเจ้าของ
 *    → คู่สัญญาเปิดลิงก์แล้วเจอ "ไม่พบสัญญา" ทุกครั้ง
 *  - PIN เก็บเป็น plaintext ในเอกสาร และเทียบใน client
 *  - ใครเปิดหน้าได้ก็เซ็นได้ทั้งสองฝ่าย และแก้เนื้อหาหลังเซ็นได้
 */

export class ContractError extends Error {
    status: number;
    code: string;
    constructor(code: string, message: string, status: number) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

export function contractErrorResponse(error: unknown) {
    if (error instanceof ContractError) {
        return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return null;
}

export type SignRole = 'employer' | 'contractor';
export const SIGN_ROLES: SignRole[] = ['employer', 'contractor'];

// ---------- PIN ----------

const PIN_MAX_FAILED_ATTEMPTS = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;

export function hashPin(pin: string): string {
    const salt = randomBytes(16);
    const hash = scryptSync(pin, salt, 32);
    return `scrypt:${salt.toString('base64')}:${hash.toString('base64')}`;
}

function verifyPinHash(pin: string, stored: string): boolean {
    const [scheme, saltB64, hashB64] = stored.split(':');
    if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
    const expected = Buffer.from(hashB64, 'base64');
    const actual = scryptSync(pin, Buffer.from(saltB64, 'base64'), expected.length);
    return timingSafeEqual(actual, expected);
}

export function newShareToken(): string {
    return randomBytes(24).toString('base64url');
}

function safeEqualString(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * ตรวจสิทธิ์เข้าถึงผ่านลิงก์แชร์ (token + PIN)
 * นับครั้งที่ใส่ PIN ผิดไว้ในเอกสาร ผิดครบ 5 ครั้งล็อก 15 นาที — PIN มีแค่ 10,000 แบบ
 */
export async function assertShareAccess(
    ref: FirebaseFirestore.DocumentReference,
    data: FirebaseFirestore.DocumentData,
    token: unknown,
    pin: unknown,
) {
    if (typeof token !== 'string' || !data.shareToken || !safeEqualString(token, data.shareToken)) {
        // ไม่บอกว่าสัญญามีอยู่จริงไหม
        throw new ContractError('not_found', 'ไม่พบสัญญา หรือลิงก์ถูกยกเลิกแล้ว', 404);
    }

    if (!data.isPinProtected) return;

    const lockedUntil: number = data.shareLockedUntil?.toMillis?.() ?? 0;
    if (lockedUntil > Date.now()) {
        throw new ContractError('pin_locked', 'ใส่ PIN ผิดหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่', 429);
    }

    if (typeof pin !== 'string' || pin.length === 0) {
        throw new ContractError('pin_required', 'กรุณาระบุ PIN', 401);
    }

    if (!data.sharePinHash || !/^\d{4}$/.test(pin) || !verifyPinHash(pin, data.sharePinHash)) {
        const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
        const failed = (data.shareFailedAttempts ?? 0) + 1;
        await ref.update(
            failed >= PIN_MAX_FAILED_ATTEMPTS
                ? { shareFailedAttempts: 0, shareLockedUntil: Timestamp.fromMillis(Date.now() + PIN_LOCK_MS) }
                : { shareFailedAttempts: FieldValue.increment(1) },
        );
        throw new ContractError('pin_invalid', 'รหัส PIN ไม่ถูกต้อง', 401);
    }

    if (data.shareFailedAttempts) {
        await ref.update({ shareFailedAttempts: 0 });
    }
}

// ---------- เนื้อหาสัญญา ----------

function partyTerms(p: any) {
    return {
        name: p?.name ?? '',
        id_card: p?.id_card ?? '',
        address: p?.address ?? '',
    };
}

/**
 * hash ของเงื่อนไขสัญญา (ไม่รวมลายเซ็น/metadata) — เก็บไว้กับลายเซ็นแต่ละฝ่าย
 * ถ้าเนื้อหาเปลี่ยนหลังฝ่ายแรกเซ็น ฝ่ายที่สองจะเซ็นไม่ได้
 */
export function contractTermsHash(data: FirebaseFirestore.DocumentData): string {
    const canonical = JSON.stringify({
        title: data.title ?? '',
        category: data.category ?? 'other',
        employer: partyTerms(data.employer),
        contractor: partyTerms(data.contractor),
        task: data.task ?? '',
        price: Number(data.price ?? 0),
        deposit: Number(data.deposit ?? 0),
        deadline: data.deadline ?? '',
        paymentTerms: data.paymentTerms ?? '',
        attachments: (data.attachments ?? []).map((a: any) => ({ name: a?.name ?? '', url: a?.url ?? '' })),
    });
    return createHash('sha256').update(canonical).digest('hex');
}

export function isCapdealContract(data: FirebaseFirestore.DocumentData): boolean {
    return typeof data.employer === 'object' && data.employer !== null
        && typeof data.contractor === 'object' && data.contractor !== null;
}

function tsToIso(v: any): string | null {
    const d = v?.toDate?.();
    return d instanceof Date ? d.toISOString() : null;
}

function maskPhone(phone?: string): string | null {
    if (!phone) return null;
    return phone.length > 4 ? `${'•'.repeat(phone.length - 4)}${phone.slice(-4)}` : phone;
}

function publicParty(p: any) {
    return {
        name: p?.name ?? '',
        id_card: p?.id_card ?? '',
        address: p?.address ?? '',
        signature: p?.signature ?? null,
        signedAt: tsToIso(p?.signedAt),
        verifiedPhoneNumber: maskPhone(p?.verifiedPhoneNumber),
    };
}

async function presignAttachment(url: string): Promise<string | null> {
    const base = process.env.R2_PUBLIC_URL;
    if (!base || !url.startsWith(`${base}/`) || !process.env.R2_BUCKET_NAME) return null;
    const key = decodeURIComponent(url.slice(base.length + 1));
    if (!key.startsWith('contracts/')) return null;
    return getSignedUrl(r2, new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }), {
        expiresIn: 10 * 60,
    });
}

/** ข้อมูลที่ส่งให้คนเปิดลิงก์แชร์ — ไม่มี token / PIN hash / uid / เบอร์เต็ม */
export async function toSharedView(id: string, data: FirebaseFirestore.DocumentData) {
    const attachments = await Promise.all(
        (data.attachments ?? []).map(async (a: any) => ({
            name: a?.name ?? '',
            type: a?.type ?? '',
            href: typeof a?.url === 'string' ? await presignAttachment(a.url).catch(() => null) : null,
        })),
    );

    return {
        id,
        title: data.title ?? '',
        category: data.category ?? 'other',
        status: data.status ?? 'draft',
        employer: publicParty(data.employer),
        contractor: publicParty(data.contractor),
        task: data.task ?? '',
        price: Number(data.price ?? 0),
        deposit: Number(data.deposit ?? 0),
        deadline: data.deadline ?? '',
        paymentTerms: data.paymentTerms ?? '',
        attachments,
        createdAt: tsToIso(data.createdAt),
    };
}

// ---------- ลายเซ็น ----------

const MAX_SIGNATURE_CHARS = 300_000;

export function assertValidSignature(signature: unknown): asserts signature is string {
    if (
        typeof signature !== 'string'
        || !signature.startsWith('data:image/png;base64,')
        || signature.length > MAX_SIGNATURE_CHARS
    ) {
        throw new ContractError('bad_signature', 'ลายเซ็นไม่ถูกต้อง', 400);
    }
}

const OTP_MAX_AGE_SECONDS = 10 * 60;

/**
 * ตรวจ ID token ของบัญชีเบอร์โทรที่ client ยืนยัน OTP มา (Firebase phone auth
 * บน app instance แยก ไม่แตะ session ของผู้ใช้) — คืนเบอร์ที่ Firebase รับรองแล้ว
 */
export async function verifyPhoneIdToken(
    auth: import('firebase-admin/auth').Auth,
    phoneIdToken: unknown,
): Promise<{ phoneNumber: string; phoneUid: string }> {
    if (typeof phoneIdToken !== 'string' || !phoneIdToken) {
        throw new ContractError('otp_required', 'กรุณายืนยันเบอร์โทรด้วย OTP', 401);
    }
    let decoded;
    try {
        decoded = await auth.verifyIdToken(phoneIdToken, true);
    } catch {
        throw new ContractError('otp_invalid', 'การยืนยัน OTP หมดอายุ กรุณาขอรหัสใหม่', 401);
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (
        decoded.firebase?.sign_in_provider !== 'phone'
        || !decoded.phone_number
        || nowSec - decoded.auth_time > OTP_MAX_AGE_SECONDS
    ) {
        throw new ContractError('otp_invalid', 'การยืนยัน OTP หมดอายุ กรุณาขอรหัสใหม่', 401);
    }
    return { phoneNumber: decoded.phone_number, phoneUid: decoded.uid };
}
