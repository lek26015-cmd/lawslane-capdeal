import 'server-only';
import Stripe from 'stripe';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * helper กลางของ webhook Stripe (PLAN-08 "helper กลาง") — หน้าตาเหมือนกันทุก repo
 *
 *   ตรวจลายเซ็น → กรอง product → จอง event → (route ประมวลผล) → done / ปลดจองถ้าพลาด
 *
 * - ลายเซ็น: constructEvent กับ raw body, tolerance 5 นาที (กัน replay event เก่า)
 * - product: บัญชี Stripe ใช้ร่วมกับเว็บอื่น (lawyer_plan / interpreter_plan ฯลฯ) event ที่ไม่ใช่
 *   ของเว็บนี้ตอบ 200 แล้วข้าม ไม่จอง ไม่เขียนอะไร
 * - จองแบบ 2 จังหวะ 'processing' → 'done' ใน collection ของเว็บนี้เอง (CapDeal = `stripe_events`
 *   ห้ามใช้ชื่อร่วมกับ Lawslane `providerPlanStripeEvents`) · instance ตายกลางทางเกิน 5 นาที
 *   ให้ประมวลผลใหม่ได้ · พลาดให้ลบตัวจองเพื่อให้ Stripe retry ทำงานได้
 * - `expireAt` ไว้ตั้ง TTL policy 30 วันใน Firestore console
 * - ห้าม log payload เต็ม — log แค่ event.id / type
 */

const SIGNATURE_TOLERANCE_SEC = 5 * 60;
// event ที่ค้าง 'processing' นานกว่านี้ถือว่า instance ก่อนหน้าตายกลางทาง ให้ประมวลผลใหม่ได้
const STALE_PROCESSING_MS = 5 * 60 * 1000;
const EVENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type ProductResolution<C> = { product: string | null; context?: C };

export type ClaimOutcome<C> =
    | { kind: 'invalid_signature' }
    | { kind: 'ignored'; event: Stripe.Event; product: string | null }
    | { kind: 'duplicate'; event: Stripe.Event }
    | { kind: 'in_progress'; event: Stripe.Event }
    | {
        kind: 'claimed';
        event: Stripe.Event;
        context: C | undefined;
        /** ประมวลผลสำเร็จ — ทำเครื่องหมาย done */
        complete: () => Promise<void>;
        /** ประมวลผลพัง — ลบตัวจองให้ retry ของ Stripe ทำงานได้ */
        release: () => Promise<void>;
    };

export async function verifyAndClaimEvent<C = unknown>(opts: {
    stripe: Stripe;
    payload: string;
    signature: string | null;
    secret: string;
    db: FirebaseFirestore.Firestore;
    /** collection สำหรับกันประมวลผลซ้ำ ของเว็บนี้เท่านั้น */
    collection: string;
    /** metadata.product ที่เว็บนี้รับ */
    product: string;
    /** หา product ของ event (อาจต้องเรียก Stripe สำหรับ invoice/charge) — throw = ตอบ 500 ให้ retry */
    resolveProduct: (event: Stripe.Event) => Promise<ProductResolution<C>>;
}): Promise<ClaimOutcome<C>> {
    let event: Stripe.Event;
    try {
        if (!opts.signature || !opts.secret) throw new Error('missing signature or secret');
        event = opts.stripe.webhooks.constructEvent(opts.payload, opts.signature, opts.secret, SIGNATURE_TOLERANCE_SEC);
    } catch (err: any) {
        // ไม่ log payload/ลายเซ็น — แค่เหตุผล
        console.error(`Stripe webhook signature verification failed: ${err?.message ?? 'unknown'}`);
        return { kind: 'invalid_signature' };
    }

    const { product, context } = await opts.resolveProduct(event);
    if (product !== opts.product) {
        return { kind: 'ignored', event, product };
    }

    const { db } = opts;
    const eventRef = db.collection(opts.collection).doc(event.id);
    const claim = await db.runTransaction(async (tx) => {
        const snap = await tx.get(eventRef);
        const data = snap.data();
        if (data?.status === 'done' || (snap.exists && !data?.status)) return 'duplicate' as const;
        const startedAt: number = data?.startedAt?.toMillis?.() ?? 0;
        if (data?.status === 'processing' && Date.now() - startedAt < STALE_PROCESSING_MS) return 'in_progress' as const;
        tx.set(eventRef, {
            type: event.type,
            status: 'processing',
            startedAt: Timestamp.now(),
            expireAt: Timestamp.fromMillis(Date.now() + EVENT_TTL_MS),
        });
        return 'claimed' as const;
    });

    if (claim === 'duplicate') return { kind: 'duplicate', event };
    if (claim === 'in_progress') return { kind: 'in_progress', event };

    return {
        kind: 'claimed',
        event,
        context,
        complete: async () => {
            await eventRef.set({ status: 'done', doneAt: Timestamp.now() }, { merge: true });
        },
        release: async () => {
            await eventRef.delete().catch(() => {});
        },
    };
}
