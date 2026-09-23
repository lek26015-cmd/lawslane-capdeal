'use server';

import { initAdmin } from '@/lib/firebase-admin';
import { requireUser, AuthError } from '@/lib/auth-guard';

/**
 * คำนวณยอดที่ต้องชำระฝั่ง server — อย่าเชื่อตัวเลขใดๆ จากเบราว์เซอร์
 *
 * ยกมาจาก Lawslane/src/app/actions/payment-actions.ts — หน้า /payment ของ repo นี้
 * มีบั๊กแบบเดียวกันทุกข้อ
 *
 * ปัญหาเดิมในหน้า /payment:
 *   1. `fee` ของการชำระแบบ case / installment / additional อ่านจาก query param
 *      (`?amount=...`) ตรงๆ → ตั้ง `?amount=1` แล้วจ่าย 1 บาทได้
 *   2. ส่วนลดคูปองตรวจและคำนวณฝั่ง client ทั้งหมด แล้ว `finalFee = fee - discount`
 *      ถูกเขียนลง Firestore เป็นยอดที่ชำระ → แก้ discountAmount ใน devtools
 *      แล้วยอดเป็น 0 ได้ทั้งที่ไม่ได้จ่าย
 *   3. การเช็ค "ยอดในสลิปตรงกับยอดที่ต้องชำระไหม" เทียบกับ finalFee ที่ client
 *      คุมเอง การตรวจจึงไม่มีความหมาย
 *
 * ทุกตัวเลขที่ใช้ตัดสินใจเรื่องเงินต้องมาจากฟังก์ชันนี้เท่านั้น
 */

export type PaymentType = 'chat' | 'appointment' | 'case' | 'installment' | 'additional';

export type ResolvedPrice = {
    ok: true;
    baseFee: number;
    discount: number;
    finalAmount: number;
    couponId: string | null;
    couponLabel: string | null;
} | {
    ok: false;
    error: string;
};

// ค่าบริการมาตรฐานของแพลตฟอร์ม — เก็บฝั่ง server เท่านั้น
const CHAT_TICKET_FEE = 500;
const APPOINTMENT_FEE = 3500;

export async function resolvePaymentAmount(input: {
    paymentType: PaymentType;
    chatId?: string;
    installmentIndex?: number;
    couponCode?: string;
}): Promise<ResolvedPrice> {
    try {
        const { uid } = await requireUser();
        const app = await initAdmin();
        if (!app) return { ok: false, error: 'ระบบยังไม่พร้อม' };
        const db = app.firestore();

        // ---------- 1) ยอดตั้งต้น ----------
        let baseFee: number;

        if (input.paymentType === 'chat') {
            baseFee = CHAT_TICKET_FEE;
        } else if (input.paymentType === 'appointment') {
            baseFee = APPOINTMENT_FEE;
        } else {
            // case / installment / additional — ยอดต้องมาจากเอกสารใน Firestore
            // ไม่ใช่จาก URL และผู้เรียกต้องเป็นคู่กรณีในห้องนั้นจริง
            if (!input.chatId) return { ok: false, error: 'ไม่พบรายการที่ต้องชำระ' };

            const chatSnap = await db.collection('chats').doc(input.chatId).get();
            if (!chatSnap.exists) return { ok: false, error: 'ไม่พบรายการที่ต้องชำระ' };

            const chat = chatSnap.data()!;
            const participants: string[] = chat.participants ?? [];
            if (!participants.includes(uid)) {
                return { ok: false, error: 'ไม่มีสิทธิ์ชำระเงินรายการนี้' };
            }

            if (input.paymentType === 'installment') {
                const installments = chat.installments;
                const i = input.installmentIndex;
                if (!Array.isArray(installments) || i === undefined || !installments[i]) {
                    return { ok: false, error: 'ไม่พบงวดที่ระบุ' };
                }
                if (installments[i].status === 'paid') {
                    return { ok: false, error: 'งวดนี้ชำระแล้ว' };
                }
                baseFee = Number(installments[i].amount) || 0;
            } else if (input.paymentType === 'additional') {
                // ค่าบริการเพิ่มเติม = ยอดที่ทนายขอไว้ใน pendingFeeRequest เท่านั้น
                // เดิมใช้ chat.amount (ยอดรวมของเคสทั้งหมด) เป็นฐาน → ลูกความถูกเรียก
                // เก็บเท่ายอดเคสเดิมทุกครั้ง แล้ว payAdditionalFee ยังบวกยอดนี้ทับ
                // chat.amount ซ้ำอีก ยอดเคสจึงเพิ่มเป็นสองเท่า
                const requested = Number(chat.pendingFeeRequest?.amount);
                if (!chat.pendingFeeRequest || !Number.isFinite(requested) || requested <= 0) {
                    return { ok: false, error: 'ไม่พบคำขอชำระค่าบริการเพิ่มเติมจากทนายความ' };
                }
                baseFee = requested;
            } else {
                baseFee = Number(chat.amount ?? chat.quotedAmount ?? 0);
            }
        }

        if (!Number.isFinite(baseFee) || baseFee < 0) {
            return { ok: false, error: 'ยอดชำระไม่ถูกต้อง' };
        }

        // ---------- 2) คูปอง ----------
        let discount = 0;
        let couponId: string | null = null;
        let couponLabel: string | null = null;

        const code = input.couponCode?.trim().toUpperCase();
        if (code) {
            const snap = await db.collection('coupons')
                .where('code', '==', code)
                .where('isActive', '==', true)
                .limit(1)
                .get();

            if (snap.empty) return { ok: false, error: 'รหัสคูปองไม่ถูกต้องหรือหมดอายุ' };

            const doc = snap.docs[0];
            const c = doc.data();

            const expiry = c.expiryDate?.toDate?.();
            if (expiry && expiry < new Date()) return { ok: false, error: 'คูปองนี้หมดอายุแล้ว' };

            if (c.usageLimit && (c.usedCount ?? 0) >= c.usageLimit) {
                return { ok: false, error: 'คูปองนี้ถูกใช้จนครบจำนวนสิทธิ์แล้ว' };
            }

            discount = c.type === 'percent'
                ? (baseFee * Number(c.value || 0)) / 100
                : Number(c.value || 0);

            // ส่วนลดห้ามเกินยอด และปัดเป็นสตางค์
            discount = Math.min(Math.max(0, Math.round(discount * 100) / 100), baseFee);
            couponId = doc.id;
            couponLabel = c.code ?? code;
        }

        return {
            ok: true,
            baseFee,
            discount,
            finalAmount: Math.max(0, Math.round((baseFee - discount) * 100) / 100),
            couponId,
            couponLabel,
        };
    } catch (e) {
        if (e instanceof AuthError) return { ok: false, error: e.message };
        console.error('resolvePaymentAmount failed:', e);
        return { ok: false, error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' };
    }
}

/**
 * ตัดสิทธิ์คูปอง 1 ครั้ง — ต้องทำฝั่ง server
 *
 * เดิม client ยิง updateDoc(coupons/{id}, { usedCount: increment(1) }) เอง
 * ซึ่งหลัง deploy firestore.rules ชุดใหม่ (coupons เขียนได้เฉพาะแอดมิน) จะถูก
 * ปฏิเสธเงียบๆ → usedCount ไม่เคยเพิ่ม คูปองใช้ซ้ำได้ไม่จำกัด
 *
 * ใช้ transaction เพื่อไม่ให้ยิงพร้อมกันแล้วเกิน usageLimit
 */
export async function redeemCoupon(couponId: string): Promise<{ ok: boolean; error?: string }> {
    try {
        await requireUser();
        const app = await initAdmin();
        if (!app) return { ok: false, error: 'ระบบยังไม่พร้อม' };
        const db = app.firestore();
        const ref = db.collection('coupons').doc(couponId);

        await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) throw new Error('ไม่พบคูปอง');
            const c = snap.data()!;
            const used = c.usedCount ?? 0;
            if (c.usageLimit && used >= c.usageLimit) throw new Error('คูปองถูกใช้ครบแล้ว');
            tx.update(ref, { usedCount: used + 1 });
        });

        return { ok: true };
    } catch (e) {
        console.error('redeemCoupon failed:', e);
        return { ok: false, error: e instanceof Error ? e.message : 'ตัดสิทธิ์คูปองไม่สำเร็จ' };
    }
}


/**
 * สร้างเอกสาร Ticket สนทนา / นัดหมาย / ค่าบริการเพิ่มเติม — ต้องทำฝั่ง server
 *
 * ยกชุดเดียวกับ Lawslane/src/app/actions/payment-actions.ts ของเดิมหน้า /payment
 * ของ repo นี้ยิง setDoc(chats/{id}) / addDoc(appointments) / updateDoc(chats/{id})
 * จากเบราว์เซอร์ทั้งหมด พร้อม `amount` ที่ตัวเองคำนวณ และกฎ Firestore ก็เป็น
 * `allow create: if isSignedIn()` เฉยๆ → ใครก็เปิด console สร้างเอกสารพร้อม
 * `amount: 0, status: 'paid'` ได้โดยไม่ต้องผ่านหน้าเว็บเลย
 *
 * repo นี้ไม่มีการตรวจสลิปอัตโนมัติ (SlipOK) — ทุกการชำระเงินเป็นการแจ้งโอนพร้อม
 * สลิป แล้วรอแอดมินตรวจ ดังนั้นสถานะที่ server เขียนได้จึงมีแค่ 'pending_payment'
 * เท่านั้น ห้ามมี path ไหนตั้ง 'active'/'paid' เองเด็ดขาด
 */

type CreateResult<T extends string> = ({ ok: true } & Record<T, string>) | { ok: false; error: string };

/**
 * หา uid ของทนายจาก lawyerProfiles ฝั่ง server
 *
 * เดิมรับ lawyerUserId จาก client แล้วใส่ลง participants ตรงๆ → ส่ง uid ใครก็ได้
 * เข้ามา คนนั้นจะได้สิทธิ์อ่านห้องแชท/สลิปของลูกความทั้งที่ไม่ใช่ทนายเจ้าของเคส
 */
async function resolveLawyerUserId(db: FirebaseFirestore.Firestore, lawyerId: string) {
    if (!lawyerId) return null;
    const snap = await db.collection('lawyerProfiles').doc(lawyerId).get();
    if (!snap.exists) return null;
    const lawyer = snap.data()!;
    if (!lawyer.userId) return null;
    return { userId: lawyer.userId as string, lawyer };
}

export async function createConsultationChat(input: {
    lawyerId: string;
    initialMessage: string;
    slipUrl?: string | null;
    couponCode?: string;
}): Promise<CreateResult<'chatId'>> {
    try {
        const { uid } = await requireUser();
        const app = await initAdmin();
        if (!app) return { ok: false, error: 'ระบบยังไม่พร้อม' };
        const db = app.firestore();

        const target = await resolveLawyerUserId(db, input.lawyerId);
        if (!target) return { ok: false, error: 'ไม่พบทนายความปลายทาง' };
        if (target.userId === uid) return { ok: false, error: 'ไม่สามารถเปิด Ticket กับตัวเองได้' };

        const price = await resolvePaymentAmount({ paymentType: 'chat', couponCode: input.couponCode });
        if (!price.ok) return { ok: false, error: price.error };

        const chatRef = db.collection('chats').doc();
        await chatRef.set({
            participants: [uid, target.userId],
            createdAt: new Date(),
            caseTitle: `Ticket สนทนา: ${input.initialMessage.substring(0, 30)}...`,
            status: 'pending_payment',
            slipUrl: input.slipUrl ?? null,
            lawyerId: input.lawyerId,
            userId: uid,
            lastMessage: input.initialMessage,
            lastMessageAt: new Date(),
            amount: price.finalAmount,
            originalFee: price.baseFee,
            discount: price.discount,
            couponCode: price.couponLabel,
            couponId: price.couponId,
            hasNewPayment: true,
        });

        await chatRef.collection('messages').add({
            text: input.initialMessage,
            senderId: uid,
            timestamp: new Date(),
        });

        if (price.couponId) {
            const redeemed = await redeemCoupon(price.couponId);
            if (!redeemed.ok) console.error('redeemCoupon failed:', redeemed.error);
        }

        return { ok: true, chatId: chatRef.id };
    } catch (e) {
        if (e instanceof AuthError) return { ok: false, error: e.message };
        console.error('createConsultationChat failed:', e);
        return { ok: false, error: 'สร้างรายการไม่สำเร็จ' };
    }
}

export async function createAppointment(input: {
    lawyerId: string;
    appointmentDate: string;
    description?: string | null;
    slipUrl?: string | null;
    couponCode?: string;
}): Promise<CreateResult<'appointmentId'>> {
    try {
        const { uid } = await requireUser();
        const app = await initAdmin();
        if (!app) return { ok: false, error: 'ระบบยังไม่พร้อม' };
        const db = app.firestore();

        const target = await resolveLawyerUserId(db, input.lawyerId);
        if (!target) return { ok: false, error: 'ไม่พบทนายความปลายทาง' };
        if (target.userId === uid) return { ok: false, error: 'ไม่สามารถนัดหมายกับตัวเองได้' };
        const lawyer = target.lawyer;

        const when = new Date(input.appointmentDate);
        if (Number.isNaN(when.getTime())) return { ok: false, error: 'วันเวลานัดหมายไม่ถูกต้อง' };

        const price = await resolvePaymentAmount({ paymentType: 'appointment', couponCode: input.couponCode });
        if (!price.ok) return { ok: false, error: price.error };

        const ref = db.collection('appointments').doc();
        await ref.set({
            userId: uid,
            lawyerId: input.lawyerId,
            lawyerUserId: target.userId,
            lawyerName: lawyer.name ?? '',
            lawyerImageUrl: lawyer.imageUrl ?? null,
            appointmentDate: when,
            description: input.description ?? null,
            status: 'pending_payment',
            createdAt: new Date(),
            slipUrl: input.slipUrl ?? null,
            amount: price.finalAmount,
            originalFee: price.baseFee,
            discount: price.discount,
            couponCode: price.couponLabel,
            couponId: price.couponId,
            hasNewPayment: true,
        });

        if (price.couponId) {
            const redeemed = await redeemCoupon(price.couponId);
            if (!redeemed.ok) console.error('redeemCoupon failed:', redeemed.error);
        }

        return { ok: true, appointmentId: ref.id };
    } catch (e) {
        if (e instanceof AuthError) return { ok: false, error: e.message };
        console.error('createAppointment failed:', e);
        return { ok: false, error: 'สร้างนัดหมายไม่สำเร็จ' };
    }
}

/**
 * แจ้งชำระค่าบริการเพิ่มเติมของเคสที่มีอยู่
 *
 * เดิม client อ่าน chats/{id}.amount แล้ว updateDoc ยอดใหม่เป็น
 * `currentAmount + finalFee` เอง → แก้ตัวเลขได้ตามใจ และยังลบ pendingFeeRequest
 * ของทนายทิ้งได้โดยไม่ต้องจ่ายอะไรเลย
 *
 * ขั้นนี้เป็นแค่ "แจ้งโอนพร้อมสลิป" — ยังไม่มีใครยืนยันว่าเงินเข้าจริง จึงเขียน
 * pendingPaymentDetails อย่างเดียวแบบเดียวกับ markCasePaidAction ของเว็บหลัก
 * ห้ามแตะ amount และห้ามล้าง pendingFeeRequest ที่นี่ ไม่งั้นแนบสลิปปลอมก็ปิด
 * คำขอของทนายได้ และยอดเคสเพิ่มขึ้นทั้งที่เงินยังไม่เข้า การปรับยอดรวม/ปิดคำขอ
 * เป็นหน้าที่ของขั้นอนุมัติสลิปฝั่งแอดมิน
 */
export async function payAdditionalFee(input: {
    chatId: string;
    slipUrl?: string | null;
    couponCode?: string;
}): Promise<{ ok: true; amount: number } | { ok: false; error: string }> {
    try {
        const { uid } = await requireUser();
        const app = await initAdmin();
        if (!app) return { ok: false, error: 'ระบบยังไม่พร้อม' };
        const db = app.firestore();

        const chatRef = db.collection('chats').doc(input.chatId);
        const chatSnap = await chatRef.get();
        if (!chatSnap.exists) return { ok: false, error: 'ไม่พบรายการที่ต้องชำระ' };

        const chat = chatSnap.data()!;
        const participants: string[] = chat.participants ?? [];
        if (!participants.includes(uid)) {
            return { ok: false, error: 'ไม่มีสิทธิ์ชำระเงินรายการนี้' };
        }

        // ทนายเป็นคนขอค่าบริการ จะมาแจ้งชำระเองไม่ได้ — participants มีทั้งสองฝ่าย
        // ด่านข้างบนจึงไม่พอ (เว็บหลักกันด้วย requireChatRole แบบเดียวกัน)
        const clientId = chat.userId || chat.clientId;
        if (clientId && clientId !== uid) {
            return { ok: false, error: 'ทนายความไม่สามารถแจ้งชำระเงินแทนลูกความได้' };
        }
        if (chat.lawyerId) {
            const lawyerSnap = await db.collection('lawyerProfiles').doc(chat.lawyerId).get();
            if (lawyerSnap.data()?.userId === uid) {
                return { ok: false, error: 'ทนายความไม่สามารถแจ้งชำระเงินแทนลูกความได้' };
            }
        }

        // ยอดมาจาก pendingFeeRequest ในเอกสาร Firestore เท่านั้น
        const price = await resolvePaymentAmount({
            paymentType: 'additional',
            chatId: input.chatId,
            couponCode: input.couponCode,
        });
        if (!price.ok) return { ok: false, error: price.error };

        await chatRef.update({
            lastPaymentAt: new Date(),
            hasNewPayment: true,
            pendingPaymentDetails: {
                amount: price.finalAmount,
                slipUrl: input.slipUrl ?? null,
                type: 'additional',
                submittedAt: new Date().toISOString(),
            },
        });

        await chatRef.collection('messages').add({
            text: `💳 ลูกความแจ้งชำระค่าบริการเพิ่มเติมจำนวน ฿${price.finalAmount.toLocaleString()} — รอตรวจสอบสลิป`,
            senderId: 'system',
            timestamp: new Date(),
        });

        if (price.couponId) {
            const redeemed = await redeemCoupon(price.couponId);
            if (!redeemed.ok) console.error('redeemCoupon failed:', redeemed.error);
        }

        return { ok: true, amount: price.finalAmount };
    } catch (e) {
        if (e instanceof AuthError) return { ok: false, error: e.message };
        console.error('payAdditionalFee failed:', e);
        return { ok: false, error: 'บันทึกการชำระเงินไม่สำเร็จ' };
    }
}
