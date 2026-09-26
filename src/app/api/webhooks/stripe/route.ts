import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { stripe } from '@/lib/stripe';
import { initAdmin } from '@/lib/firebase-admin';
import { planIdForPriceId } from '@/lib/entitlement';
import Stripe from 'stripe';

// event ที่ค้าง 'processing' นานกว่านี้ถือว่า instance ก่อนหน้าตายกลางทาง ให้ประมวลผลใหม่ได้
const STALE_PROCESSING_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
    const payload = await req.text();
    const signature = req.headers.get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            payload,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return NextResponse.json({ error: 'Webhook Error' }, { status: 400 });
    }

    // ตอบ 500 ให้ Stripe retry — เดิม admin init ไม่ได้ก็ตอบ 200 แล้ว event หายเงียบ
    const adminApp = await initAdmin();
    if (!adminApp) {
        console.error('Stripe webhook: Firebase Admin not initialized');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const db = adminApp.firestore();

    // กัน replay แบบ 2 จังหวะ: จอง 'processing' → ทำงาน → 'done'
    // เดิมเขียน marker ก่อนแล้วไม่เคยลบ ถ้าประมวลผลพังครั้งเดียว retry ของ Stripe
    // จะโดนมองว่าซ้ำ → ลูกค้าจ่ายเงินแล้วแต่ไม่ได้แพลน และไม่มีใครลองใหม่
    const eventRef = db.collection('stripe_events').doc(event.id);
    const claim = await db.runTransaction(async (tx) => {
        const snap = await tx.get(eventRef);
        const data = snap.data();
        if (data?.status === 'done' || (snap.exists && !data?.status)) return 'duplicate';
        const startedAt: number = data?.startedAt?.toMillis?.() ?? 0;
        if (data?.status === 'processing' && Date.now() - startedAt < STALE_PROCESSING_MS) return 'in_progress';
        tx.set(eventRef, { type: event.type, status: 'processing', startedAt: Timestamp.now() });
        return 'claimed';
    });

    if (claim === 'duplicate') {
        return NextResponse.json({ received: true, duplicate: true });
    }
    if (claim === 'in_progress') {
        // อีก instance กำลังทำอยู่ — ให้ Stripe ส่งมาใหม่ทีหลัง
        return NextResponse.json({ error: 'Event in progress' }, { status: 409 });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                if (session.mode === 'subscription' || session.mode === 'payment') {
                    await handleCheckoutSessionCompleted(db, session);
                }
                break;
            }
            case 'customer.subscription.updated': {
                await handleSubscriptionUpdated(db, event.data.object as Stripe.Subscription);
                break;
            }
            case 'customer.subscription.deleted': {
                await handleSubscriptionDeleted(db, event.data.object as Stripe.Subscription);
                break;
            }
            default:
                break;
        }

        await eventRef.set({ status: 'done', doneAt: Timestamp.now() }, { merge: true });
        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Error handling webhook:', error);
        // ปลด marker ให้ retry ครั้งถัดไปทำงานได้
        await eventRef.delete().catch(() => {});
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * อ่านรอบบิลจาก subscription — API version ใหม่ (2025-03-31 basil ขึ้นไป) ย้าย
 * current_period_* ไปอยู่ที่ items แล้ว payload ของ webhook ใช้ version ของ endpoint
 * ไม่ใช่ของ SDK เดิมอ่านที่ top-level ได้ NaN → เขียน Firestore พัง
 */
function periodOf(subscription: Stripe.Subscription): { start: Date | null; end: Date | null } {
    const s = subscription as any;
    const item = s.items?.data?.[0];
    const endSec = item?.current_period_end ?? s.current_period_end;
    const startSec = item?.current_period_start ?? s.current_period_start;
    const toDate = (sec: unknown) => (typeof sec === 'number' && Number.isFinite(sec) ? new Date(sec * 1000) : null);
    return { start: toDate(startSec), end: toDate(endSec) };
}

function priceIdOf(subscription: Stripe.Subscription): string | null {
    return subscription.items?.data?.[0]?.price?.id ?? null;
}

/**
 * หา user ของ subscription: metadata.userId (ใส่ตอน checkout) ก่อน แล้วค่อยหาด้วย customerId
 * เดิมหาด้วย customerId อย่างเดียว ซึ่งถูกเขียนทับเมื่อลูกค้าซื้อซ้ำ → event ของ
 * subscription เดิมหา user ไม่เจอ
 */
async function findUserRef(db: FirebaseFirestore.Firestore, subscription: Stripe.Subscription) {
    const metaUid = subscription.metadata?.userId;
    if (metaUid) {
        const ref = db.collection('users').doc(metaUid);
        if ((await ref.get()).exists) return ref;
    }
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    const snap = await db.collection('users')
        .where('subscription.customerId', '==', customerId)
        .limit(1)
        .get();
    return snap.empty ? null : snap.docs[0].ref;
}

async function handleCheckoutSessionCompleted(db: FirebaseFirestore.Firestore, session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const metaPlanId = session.metadata?.planId;
    const billingInterval = session.metadata?.billingInterval || 'month';
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!userId || !metaPlanId) {
        console.error('Missing metadata in checkout session');
        return;
    }

    // ต้องจ่ายเงินสำเร็จจริงก่อนถึงให้สิทธิ์แพลน
    // (โหมด subscription ที่เป็น trial จะเป็น 'no_payment_required' ซึ่งถือว่าผ่าน)
    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
        console.warn(`Checkout session ${session.id} is not paid (${session.payment_status}) — skipping`);
        return;
    }

    let planId = metaPlanId;
    let status = 'active';
    let currentPeriodStart: Date | null = new Date();
    let currentPeriodEnd: Date | null;

    if (session.mode === 'subscription' && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        // เชื่อราคาที่จ่ายจริงมากกว่า metadata
        planId = planIdForPriceId(priceIdOf(subscription)) ?? metaPlanId;
        status = subscription.status;
        ({ start: currentPeriodStart, end: currentPeriodEnd } = periodOf(subscription));
    } else {
        // One-time payment (PromptPay)
        const now = new Date();
        currentPeriodEnd = billingInterval === 'year'
            ? new Date(new Date(now).setFullYear(now.getFullYear() + 1))
            : new Date(new Date(now).setMonth(now.getMonth() + 1));
    }

    await db.collection('users').doc(userId).set({
        subscription: {
            planId,
            status,
            currentPeriodStart,
            currentPeriodEnd,
            customerId,
            subscriptionId: subscriptionId || null,
            updatedAt: FieldValue.serverTimestamp(),
        }
    }, { merge: true });
}

async function handleSubscriptionUpdated(db: FirebaseFirestore.Firestore, subscription: Stripe.Subscription) {
    const userRef = await findUserRef(db, subscription);
    if (!userRef) {
        console.error('User not found for subscription:', subscription.id);
        return;
    }

    const current = (await userRef.get()).data()?.subscription ?? {};

    // subscription เก่าที่ไม่ใช่ตัวปัจจุบันของผู้ใช้ — อย่าให้มาเขียนทับแพลนที่ใช้อยู่
    if (current.subscriptionId && current.subscriptionId !== subscription.id
        && ['active', 'trialing', 'past_due'].includes(current.status)) {
        console.warn(`Ignoring update for non-current subscription ${subscription.id}`);
        return;
    }

    // เปลี่ยนแพลนผ่าน Billing Portal → อ่านจาก price ที่ใช้อยู่จริง
    // (เดิมเขียน planId เดิมกลับ อัปเกรดแล้วยังได้ลิมิตแพลนเก่า)
    const planId = planIdForPriceId(priceIdOf(subscription)) ?? current.planId ?? null;
    const { start, end } = periodOf(subscription);

    const update: Record<string, unknown> = {
        status: subscription.status,
        subscriptionId: subscription.id,
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
        updatedAt: FieldValue.serverTimestamp(),
    };
    if (planId) update.planId = planId;
    if (start) update.currentPeriodStart = start;
    if (end) update.currentPeriodEnd = end;

    await userRef.set({ subscription: update }, { merge: true });
}

async function handleSubscriptionDeleted(db: FirebaseFirestore.Firestore, subscription: Stripe.Subscription) {
    const userRef = await findUserRef(db, subscription);
    if (!userRef) return;

    const current = (await userRef.get()).data()?.subscription ?? {};
    // ยกเลิก subscription เก่า ต้องไม่ทำให้ตัวที่ใช้อยู่ถูกตัดสิทธิ์
    if (current.subscriptionId && current.subscriptionId !== subscription.id) return;

    await userRef.set({
        subscription: {
            status: 'canceled',
            updatedAt: FieldValue.serverTimestamp(),
        }
    }, { merge: true });
}
