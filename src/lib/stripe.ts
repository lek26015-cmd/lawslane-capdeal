import 'server-only';
import Stripe from 'stripe';

/**
 * Stripe client ฝั่ง server — สร้างตอนเรียกใช้ครั้งแรก
 *
 * - ไม่ปัก apiVersion: ใช้ version ที่มากับ SDK (เดิม '2024-06-20' as any ไม่ตรงกับ type
 *   ของ SDK และไม่ตรงกับ version ของ webhook endpoint)
 * - ไม่มี key ให้ throw ชัด ๆ ตอนเรียก ไม่ใช่ตอน import — `next build` จะได้ไม่พังในเครื่อง
 *   ที่ไม่มี secret (เดิมส่ง '' ไปเงียบ ๆ แล้วไปพังเป็น 401 ที่ Stripe)
 * - ต้องเป็น Restricted key (`rk_…`) ตามแผน PLAN-08 หลักข้อ 6 ห้ามใช้ secret key ตัวเต็ม
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
    if (client) return client;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        throw new Error('STRIPE_SECRET_KEY is not set (ต้องเป็น Restricted key rk_… ใน env ของ Vercel)');
    }
    if (!key.startsWith('rk_') && process.env.NODE_ENV === 'production') {
        // ไม่ throw — แค่เตือนให้เปลี่ยนเป็น Restricted key (ไม่ log ค่า key)
        console.warn('STRIPE_SECRET_KEY is not a restricted key (rk_…) — see PLAN-08 security rule 6');
    }
    client = new Stripe(key, {
        appInfo: {
            name: 'Lawslane CapDeal',
            version: '0.1.0',
        },
    });
    return client;
}
