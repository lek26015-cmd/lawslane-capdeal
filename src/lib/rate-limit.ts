import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * จำกัดจำนวนครั้งต่อผู้ใช้แบบ sliding window ใน Firestore (`rate_limits/{key}` เขียนได้เฉพาะ Admin SDK)
 * ใช้กับ endpoint ที่แตะเงิน เช่นสร้าง Checkout (PLAN-08 หลักข้อ 11: 5 ครั้งต่อ 10 นาที กัน card testing)
 *
 * key ต้องขึ้นต้นด้วยชื่อเว็บ/การกระทำ (เช่น `capdeal_checkout_{uid}`) — collection นี้ใช้ร่วมกับ
 * Lawslane ซึ่งใช้ doc id = uid เปล่า ๆ
 *
 * พลาด (Firestore ล่ม) = ปฏิเสธ — endpoint เงินต้องปลอดภัยไว้ก่อน
 */
export async function consumeRateLimit(
    db: FirebaseFirestore.Firestore,
    key: string,
    limit: number,
    windowMs: number,
): Promise<boolean> {
    const ref = db.collection('rate_limits').doc(key);
    const now = Date.now();
    try {
        return await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const timestamps: number[] = (snap.data()?.timestamps ?? []).filter(
                (ts: unknown) => typeof ts === 'number' && ts > now - windowMs,
            );
            if (timestamps.length >= limit) return false;
            timestamps.push(now);
            tx.set(ref, { timestamps, lastUpdate: FieldValue.serverTimestamp() });
            return true;
        });
    } catch (e: any) {
        console.error('rate limit check failed:', e?.message ?? 'unknown');
        return false;
    }
}
