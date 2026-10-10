import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import { CAPDEAL_PRODUCT } from '@/lib/capdeal-billing';

/**
 * แจ้งเตือนเรื่องเงินให้แอดมิน (PLAN-08 หลักข้อ 4, 13)
 *
 * เขียน `billingAlerts` (Admin SDK เท่านั้น) — ใส่ได้แค่ id ภายใน/ของ Stripe, ยอด และประเภท
 * ห้ามใส่ชื่อ อีเมล หรือเบอร์โทร · ถ้าตั้ง env `BILLING_ALERT_EMAIL` จะส่งอีเมลสั้น ๆ ไปด้วย
 * (ส่งไม่ได้ไม่ทำให้ webhook พัง)
 */
export type BillingAlertType =
    | 'unknown_price'
    | 'user_not_found'
    | 'duplicate_subscription'
    | 'charge_refunded'
    | 'charge_dispute_created'
    | 'checkout_async_payment_failed';

export type BillingAlert = {
    type: BillingAlertType;
    eventId: string;
    eventType: string;
    uid?: string | null;
    subscriptionId?: string | null;
    otherSubscriptionId?: string | null;
    customerId?: string | null;
    chargeId?: string | null;
    disputeId?: string | null;
    priceId?: string | null;
    amount?: number | null;
    currency?: string | null;
    reason?: string | null;
};

const FROM = 'Lawslane <noreply@lawslane.com>';

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export async function writeBillingAlert(db: FirebaseFirestore.Firestore, alert: BillingAlert) {
    // id คงที่ต่อ event+ประเภท — event เดิมถูกประมวลผลซ้ำก็ไม่เกิดแจ้งเตือนซ้ำ
    const ref = db.collection('billingAlerts').doc(`capdeal_${alert.eventId}_${alert.type}`);
    await ref.set({
        ...clean(alert),
        product: CAPDEAL_PRODUCT,
        resolved: false,
        createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    console.warn(`billingAlert ${alert.type} event=${alert.eventId}`);
    await emailAdmin(alert).catch((e) => console.error('billingAlert email failed:', e?.message ?? 'unknown'));
}

async function emailAdmin(alert: BillingAlert) {
    const to = process.env.BILLING_ALERT_EMAIL;
    if (!to || !process.env.RESEND_API_KEY) return;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const lines = Object.entries(clean(alert)).map(([k, v]) => `${k}: ${String(v)}`).join('\n');
    await resend.emails.send({
        from: FROM,
        to: [to],
        subject: `[CapDeal billing] ${alert.type}`,
        text: `แจ้งเตือนจาก webhook Stripe ของ CapDeal\n\n${lines}\n\nดูรายละเอียดใน Stripe Dashboard และ Firestore billingAlerts`,
    });
}

/**
 * แจ้งลูกค้าทางอีเมลว่าตัดบัตรไม่ผ่าน — อีเมลดึงจาก Firebase Auth ไม่ใช่จาก Stripe metadata
 * ไม่มี RESEND_API_KEY / ไม่มีอีเมล = ข้าม (หน้าเว็บยังแสดงแจ้งเตือนจาก paymentFailedAt)
 */
export async function emailPaymentFailed(email: string | null | undefined, appUrl: string) {
    if (!email || !process.env.RESEND_API_KEY) return;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const accountUrl = `${appUrl.replace(/\/$/, '')}/th/account`;
    await resend.emails.send({
        from: FROM,
        to: [email],
        subject: '[Lawslane CapDeal] ชำระค่าแพ็กเกจไม่สำเร็จ',
        html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a365d;">ชำระค่าแพ็กเกจ CapDeal ไม่สำเร็จ</h2>
          <p>ระบบตัดเงินค่าแพ็กเกจรอบล่าสุดไม่สำเร็จ คุณยังใช้งานแพ็กเกจได้อีก 3 วัน</p>
          <p>กรุณาอัปเดตวิธีชำระเงินที่หน้า "บัญชีของฉัน" → Billing Portal เพื่อใช้งานต่อโดยไม่สะดุด</p>
          <a href="${accountUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            ไปที่บัญชีของฉัน
          </a>
        </div>
        `,
    });
}
