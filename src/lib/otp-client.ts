'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import {
    Auth,
    ConfirmationResult,
    RecaptchaVerifier,
    getAuth,
    inMemoryPersistence,
    setPersistence,
    signInWithPhoneNumber,
    signOut,
} from 'firebase/auth';
import { initializeFirebase } from '@/firebase';

/**
 * OTP สำหรับเซ็นสัญญา ทำบน Firebase app instance แยก ('capdeal-otp')
 *
 * เดิมเรียก signInWithPhoneNumber บน auth หลัก → confirm() แล้วผู้ใช้ถูกสลับไปเป็น
 * บัญชีเบอร์โทรใหม่ เจ้าของสัญญาหลุดจากบัญชีตัวเอง และบันทึกลายเซ็นไม่ผ่าน rules
 * instance แยก + inMemoryPersistence จึงไม่แตะ session หลักเลย
 * ผลที่ได้คือ phone ID token ที่ส่งให้ server ตรวจเอง
 */
const OTP_APP_NAME = 'capdeal-otp';

async function getOtpAuth(): Promise<Auth> {
    const existing = getApps().find((a) => a.name === OTP_APP_NAME);
    if (existing) return getAuth(existing);

    const { firebaseApp } = initializeFirebase();
    const app = initializeApp((firebaseApp ?? getApp()).options, OTP_APP_NAME);
    const auth = getAuth(app);
    auth.languageCode = 'th';
    await setPersistence(auth, inMemoryPersistence);
    return auth;
}

/** แปลง 08x-xxx-xxxx เป็น E.164 (+668xxxxxxxx) */
export function toE164Thai(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (/^0\d{9}$/.test(digits)) return `+66${digits.slice(1)}`;
    if (/^66\d{9}$/.test(digits)) return `+${digits}`;
    return null;
}

let verifier: RecaptchaVerifier | null = null;

/** container ต้องอยู่ใน DOM แล้ว (สร้างตอนกดส่ง ไม่ใช่ตอนโหลดหน้า) */
export async function sendSigningOtp(phoneE164: string, container: HTMLElement): Promise<ConfirmationResult> {
    const auth = await getOtpAuth();
    verifier?.clear();
    verifier = new RecaptchaVerifier(auth, container, { size: 'invisible' });
    try {
        return await signInWithPhoneNumber(auth, phoneE164, verifier);
    } catch (e) {
        verifier.clear();
        verifier = null;
        throw e;
    }
}

/** ยืนยันรหัสแล้วคืน phone ID token — ออกจากบัญชีเบอร์โทรทันทีหลังได้ token */
export async function confirmSigningOtp(confirmation: ConfirmationResult, code: string): Promise<string> {
    const result = await confirmation.confirm(code);
    const idToken = await result.user.getIdToken();
    const auth = await getOtpAuth();
    await signOut(auth).catch(() => {});
    verifier?.clear();
    verifier = null;
    return idToken;
}

export function otpErrorMessage(error: unknown): string {
    const code = (error as { code?: string })?.code ?? '';
    switch (code) {
        case 'auth/invalid-phone-number':
            return 'หมายเลขโทรศัพท์ไม่ถูกต้อง';
        case 'auth/too-many-requests':
            return 'ขอรหัสบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
        case 'auth/invalid-verification-code':
            return 'รหัส OTP ไม่ถูกต้อง';
        case 'auth/code-expired':
            return 'รหัส OTP หมดอายุ กรุณาขอรหัสใหม่';
        case 'auth/operation-not-allowed':
            return 'ระบบยืนยันเบอร์โทรยังไม่เปิดใช้งาน กรุณาติดต่อผู้ดูแล';
        default:
            return 'ไม่สามารถยืนยันเบอร์โทรได้ กรุณาลองใหม่อีกครั้ง';
    }
}
