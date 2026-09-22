import 'server-only';
import { cookies, headers } from 'next/headers';
import { initAdmin } from './firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';

/**
 * ด่านตรวจสิทธิ์ผู้ใช้ฝั่ง server สำหรับ capdeal
 *
 * กติกาเดียวที่ต้องจำ: **ตัวตนมาจาก token เสมอ ห้ามรับ userId เป็น argument**
 * route ในแอปนี้หลายตัวเคยรับ { userId } จาก body แล้วเชื่อเลย ทั้งที่ใช้ Admin SDK
 * ซึ่งข้าม Firestore rules → กลายเป็น IDOR ตรงๆ (ดูแผนความปลอดภัย §5)
 *
 * ⚠️ middleware.ts ของแอปนี้ใช้เป็นด่านไม่ได้: ตรรกะ auth ทำงานเฉพาะเมื่อ host
 *    ขึ้นต้นด้วย `business.` และ matcher ก็ไม่ครอบ /api
 *
 * หลังบ้านของ capdeal ย้ายไป admin.lawslane.com/capdeal แล้ว (Module 7)
 * requireAdmin() ด้านล่างเหลือไว้กัน server action ที่ยังอยู่ในรีโปนี้
 */

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

type Session = {
  uid: string;
  token: DecodedIdToken;
  adminApp: NonNullable<Awaited<ReturnType<typeof initAdmin>>>;
};

/** ผู้เรียกต้องล็อกอินอยู่จริง — คืน uid ที่ผ่านการตรวจลายเซ็นแล้ว */
export async function requireUser(): Promise<Session> {
  const adminApp = await initAdmin();
  if (!adminApp) {
    throw new AuthError('Server misconfigured: Firebase Admin not initialized', 500);
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (sessionCookie) {
    try {
      // checkRevoked: true → บัญชีที่ถูกระงับใช้ต่อไม่ได้ ไม่ต้องรอ cookie หมดอายุ
      const token = await adminApp.auth().verifySessionCookie(sessionCookie, true);
      return { uid: token.uid, token, adminApp };
    } catch {
      // ตกไปลองทาง Bearer ต่อ
    }
  }

  const headersList = await headers();
  const authHeader = headersList.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = await adminApp.auth().verifyIdToken(authHeader.slice('Bearer '.length), true);
      return { uid: token.uid, token, adminApp };
    } catch {
      throw new AuthError('Unauthorized: invalid token', 401);
    }
  }

  throw new AuthError('Unauthorized: no valid session', 401);
}

/**
 * ผู้เรียกต้องเป็นเจ้าของ uid นั้น หรือเป็นแอดมิน
 * ใช้แทน pattern เดิมที่รับ { userId } จาก body มาใช้ตรงๆ
 */
export async function requireSelfOrAdmin(targetUid: string): Promise<Session> {
  const session = await requireUser();
  const isAdmin = session.token.admin === true || session.token.role === 'admin';
  if (session.uid !== targetUid && !isAdmin) {
    throw new AuthError('Forbidden', 403);
  }
  return session;
}

/**
 * ผู้เรียกต้องเป็นแอดมิน — ใช้กับ server action ที่แตะข้อมูลการเงิน
 *
 * ยึด session cookie เป็นหลักเหมือน requireUser() และรับ claim ทั้ง `admin`
 * และ `role` ให้ตรงกับ Lawslane/
 */
export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (session.token.admin !== true && session.token.role !== 'admin') {
    throw new AuthError('Forbidden: admin access required', 403);
  }
  return session;
}

/** ตัวช่วยสำหรับ API route */
export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error('AUTH_GUARD_UNEXPECTED_ERROR', error);
  return Response.json({ error: 'Internal Server Error' }, { status: 500 });
}

/**
 * คืน origin ที่ปลอดภัยสำหรับใช้สร้าง return_url / success_url ของ Stripe
 *
 * header `origin` ผู้เรียกกำหนดเองได้ — ถ้าเอามาต่อ URL ตรงๆ ผู้ใช้จะถูกเด้ง
 * ออกไปเว็บนอกหลังจ่ายเงินเสร็จ จึงรับเฉพาะ origin ที่อยู่ใน allowlist
 */
export function safeOrigin(requestOrigin: string | null): string {
  const fallback = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  if (!requestOrigin) return fallback;

  try {
    const url = new URL(requestOrigin);
    const host = url.hostname;
    const allowed =
      host === 'lawslane.com' ||
      host.endsWith('.lawslane.com') ||
      host === 'localhost' ||
      host === '127.0.0.1';
    return allowed ? url.origin : fallback;
  } catch {
    return fallback;
  }
}
