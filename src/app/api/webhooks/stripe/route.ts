import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { initAdmin } from '@/lib/firebase-admin';
import { verifyAndClaimEvent, ProductResolution } from '@/lib/stripe-webhook';
import { writeBillingAlert, emailPaymentFailed } from '@/lib/billing-alerts';
import {
    CAPDEAL_PRODUCT,
    checkoutFulfillable,
    decideSubscriptionWrite,
    hasLiveSubscription,
    idOf,
    isCapdealProduct,
    isLiveStatus,
    nextPastDueSince,
    periodOf,
    planIdForPriceId,
    priceOf,
    toMillis,
} from '@/lib/capdeal-billing';

/**
 * Webhook Stripe ของ CapDeal (แพลน Lite/Pro/Scale)
 *
 * - ให้สิทธิ์จากที่นี่เท่านั้น หน้า checkout/return แค่รอดูผล
 * - รับเฉพาะ metadata.product = 'capdeal_plan' — event อื่นในบัญชีเดียวกัน (แพลนทนาย/ล่ามของ
 *   Lawslane ฯลฯ) ตอบ 200 แล้วข้าม
 * - สถานะ subscription ดึงล่าสุดด้วย subscriptions.retrieve ทุกครั้ง ไม่เชื่อ event.data.object
 *   เพราะ event มาไม่ตามลำดับได้
 * - แพลนมาจาก Price ที่จ่ายจริงเท่านั้น (planIdForPriceId) ไม่รู้จัก = ไม่ให้แพลน + billingAlerts
 * - ไม่คืนเงิน/ยกเลิกอัตโนมัติ (key ของเว็บนี้อ่าน Subscriptions ได้อย่างเดียว) — แจ้งแอดมินแทน
 */

const HANDLED_EVENTS = new Set([
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.paid',
    'invoice.payment_failed',
    'charge.refunded',
    'charge.dispute.created',
]);

type Ctx = {
    stripe: Stripe;
    db: FirebaseFirestore.Firestore;
    auth: import('firebase-admin').auth.Auth;
    event: Stripe.Event;
};

/** บริบทที่หาได้ตอนกรอง product — ส่งต่อให้ handler ไม่ต้องเรียก Stripe ซ้ำ */
type Resolved = { subscriptionId?: string | null; customerId?: string | null; uid?: string | null };

export async function POST(req: NextRequest) {
    const payload = await req.text();

    // ตอบ 500 ให้ Stripe retry — admin init ไม่ได้อย่าตอบ 200 แล้วปล่อย event หาย
    const adminApp = await initAdmin();
    if (!adminApp) {
        console.error('Stripe webhook: Firebase Admin not initialized');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const db = adminApp.firestore();

    let stripe: Stripe;
    try {
        stripe = getStripe();
    } catch (e: any) {
        console.error('Stripe webhook:', e?.message ?? 'Stripe not configured');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    let outcome;
    try {
        outcome = await verifyAndClaimEvent<Resolved>({
            stripe,
            payload,
            signature: req.headers.get('stripe-signature'),
            secret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
            db,
            collection: 'stripe_events',
            product: CAPDEAL_PRODUCT,
            resolveProduct: (event) => resolveProduct(stripe, db, event),
        });
    } catch (e: any) {
        console.error('Stripe webhook: claim/resolve failed:', e?.message ?? 'unknown');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    switch (outcome.kind) {
        case 'invalid_signature':
            return NextResponse.json({ error: 'Webhook Error' }, { status: 400 });
        case 'ignored':
            return NextResponse.json({ received: true, ignored: true });
        case 'duplicate':
            return NextResponse.json({ received: true, duplicate: true });
        case 'in_progress':
            // อีก instance กำลังทำอยู่ — ให้ Stripe ส่งมาใหม่ทีหลัง
            return NextResponse.json({ error: 'Event in progress' }, { status: 409 });
    }

    const { event, context, complete, release } = outcome;
    try {
        await handleEvent({ stripe, db, auth: adminApp.auth(), event }, context ?? {});
        await complete();
        return NextResponse.json({ received: true });
    } catch (error: any) {
        // ไม่ log object error ทั้งก้อน (อาจมี payload ของ Stripe ติดมา)
        console.error(`Stripe webhook: failed ${event.type} ${event.id}:`, error?.message ?? 'unknown');
        await release();
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// กรอง product
// ---------------------------------------------------------------------------

async function resolveProduct(
    stripe: Stripe,
    db: FirebaseFirestore.Firestore,
    event: Stripe.Event,
): Promise<ProductResolution<Resolved>> {
    if (!HANDLED_EVENTS.has(event.type)) return { product: null };

    switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
        case 'checkout.session.async_payment_failed': {
            const session = event.data.object as Stripe.Checkout.Session;
            return { product: session.metadata?.product ?? null };
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            const sub = event.data.object as Stripe.Subscription;
            return { product: sub.metadata?.product ?? null, context: { subscriptionId: sub.id } };
        }
        case 'invoice.paid':
        case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice;
            const details = invoice.parent?.subscription_details;
            return {
                product: details?.metadata?.product ?? null,
                context: { subscriptionId: idOf(details?.subscription as any), customerId: idOf(invoice.customer as any) },
            };
        }
        case 'charge.refunded': {
            const charge = event.data.object as Stripe.Charge;
            return resolveFromPayment(stripe, db, idOf(charge.payment_intent as any), idOf(charge.customer as any));
        }
        case 'charge.dispute.created': {
            const dispute = event.data.object as Stripe.Dispute;
            let customerId: string | null = null;
            const piId = idOf(dispute.payment_intent as any);
            const byInvoice = await resolveFromPayment(stripe, db, piId, null);
            if (byInvoice.product) return byInvoice;
            const chargeId = idOf(dispute.charge as any);
            if (chargeId) {
                try {
                    customerId = idOf((await stripe.charges.retrieve(chargeId)).customer as any);
                } catch (e: any) {
                    console.warn(`Stripe webhook: charge lookup failed: ${e?.code ?? e?.type ?? 'unknown'}`);
                }
            }
            return resolveFromPayment(stripe, db, null, customerId);
        }
    }
    return { product: null };
}

/**
 * charge/dispute ไม่มี metadata ของเรา: หา invoice จาก payment_intent ก่อน (ได้ metadata ของ
 * subscription ตอนออก invoice) ไม่เจอค่อยหาจาก customer ที่บันทึกไว้ใน users.subscription
 * (ช่องนี้มีแต่ CapDeal ที่เขียน — แพลนทนายอยู่ lawyerProfiles.plan, Wittaya อยู่ paidPlans)
 */
async function resolveFromPayment(
    stripe: Stripe,
    db: FirebaseFirestore.Firestore,
    paymentIntentId: string | null,
    customerId: string | null,
): Promise<ProductResolution<Resolved>> {
    if (paymentIntentId) {
        // หาไม่ได้ (เช่น key ไม่มีสิทธิ์) ให้ไปหาจาก customer ต่อ — ไม่ตอบ 500 ซ้ำ ๆ กับ charge ของเว็บอื่น
        const payments = await stripe.invoicePayments.list({
            payment: { type: 'payment_intent', payment_intent: paymentIntentId },
            limit: 1,
            expand: ['data.invoice'],
        }).catch((e: any) => {
            console.warn(`Stripe webhook: invoice payment lookup failed: ${e?.code ?? e?.type ?? 'unknown'}`);
            return null;
        });
        const invoice = payments?.data[0]?.invoice;
        if (invoice && typeof invoice !== 'string') {
            const details = (invoice as Stripe.Invoice).parent?.subscription_details;
            if (details) {
                return {
                    product: details.metadata?.product ?? null,
                    context: { subscriptionId: idOf(details.subscription as any), customerId: idOf((invoice as Stripe.Invoice).customer as any) },
                };
            }
        }
    }
    if (customerId) {
        const snap = await db.collection('users').where('subscription.customerId', '==', customerId).limit(1).get();
        if (!snap.empty) {
            const doc = snap.docs[0];
            return {
                product: CAPDEAL_PRODUCT,
                context: { subscriptionId: doc.data()?.subscription?.subscriptionId ?? null, customerId, uid: doc.id },
            };
        }
    }
    return { product: null };
}

// ---------------------------------------------------------------------------
// ประมวลผล
// ---------------------------------------------------------------------------

async function handleEvent(ctx: Ctx, resolved: Resolved) {
    const { event, stripe } = ctx;
    switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded': {
            // ดึง session ล่าสุด — payment_status ใน payload อาจเก่ากว่าความจริง
            const session = await stripe.checkout.sessions.retrieve((event.data.object as Stripe.Checkout.Session).id);
            const decision = checkoutFulfillable(session);
            if (!decision.ok) {
                console.warn(`Checkout ${session.id} not fulfilled: ${decision.reason}`);
                return;
            }
            await syncSubscription(ctx, idOf(session.subscription as any)!, {
                uidHint: session.metadata?.uid ?? null,
            });
            return;
        }
        case 'checkout.session.async_payment_failed': {
            // subscription จะไม่ active เอง ไม่ต้องทำอะไร แค่บันทึกไว้
            console.warn(`Checkout ${(event.data.object as Stripe.Checkout.Session).id} async payment failed`);
            return;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            await syncSubscription(ctx, resolved.subscriptionId!, {});
            return;
        }
        case 'invoice.paid': {
            if (!resolved.subscriptionId) return;
            await syncSubscription(ctx, resolved.subscriptionId, { clearPaymentFailed: true });
            return;
        }
        case 'invoice.payment_failed': {
            if (!resolved.subscriptionId) return;
            const result = await syncSubscription(ctx, resolved.subscriptionId, {
                paymentFailedAt: Timestamp.fromMillis(event.created * 1000),
            });
            // ส่งอีเมลครั้งแรกที่เริ่มค้างชำระเท่านั้น (Smart Retries ส่ง event นี้หลายครั้ง)
            if (result?.newlyFailed && result.uid) {
                const email = await ctx.auth.getUser(result.uid).then((u) => u.email).catch(() => null);
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://capdeal.lawslane.com';
                await emailPaymentFailed(email, appUrl).catch((e) =>
                    console.error('payment_failed email failed:', e?.message ?? 'unknown'));
            }
            return;
        }
        case 'charge.refunded':
        case 'charge.dispute.created': {
            const obj = event.data.object as Stripe.Charge | Stripe.Dispute;
            const isDispute = event.type === 'charge.dispute.created';
            await writeBillingAlert(ctx.db, {
                type: isDispute ? 'charge_dispute_created' : 'charge_refunded',
                eventId: event.id,
                eventType: event.type,
                uid: resolved.uid ?? null,
                subscriptionId: resolved.subscriptionId ?? null,
                customerId: resolved.customerId ?? null,
                chargeId: isDispute ? idOf((obj as Stripe.Dispute).charge as any) : obj.id,
                disputeId: isDispute ? obj.id : null,
                amount: isDispute ? (obj as Stripe.Dispute).amount : (obj as Stripe.Charge).amount_refunded,
                currency: obj.currency,
                reason: isDispute ? (obj as Stripe.Dispute).reason : null,
            });
            // ไม่ยกเลิก/คืนเงินเอง — แค่ sync สถานะล่าสุดจาก Stripe (ถ้าแอดมินยกเลิกแล้วจะตามมาเอง)
            if (resolved.subscriptionId) await syncSubscription(ctx, resolved.subscriptionId, {});
            return;
        }
    }
}

async function retrieveSubscription(stripe: Stripe, id: string): Promise<Stripe.Subscription | null> {
    try {
        return await stripe.subscriptions.retrieve(id);
    } catch (e: any) {
        if (e?.code === 'resource_missing') return null;
        throw e;
    }
}

/** หา user ของ subscription: metadata.uid (ใส่ตอน checkout จาก token) ก่อน แล้วค่อยหาด้วย customerId */
async function findUserRef(db: FirebaseFirestore.Firestore, uidHint: string | null, customerId: string | null) {
    if (uidHint) {
        const ref = db.collection('users').doc(uidHint);
        if ((await ref.get()).exists) return ref;
    }
    if (!customerId) return null;
    const snap = await db.collection('users').where('subscription.customerId', '==', customerId).limit(1).get();
    return snap.empty ? null : snap.docs[0].ref;
}

/**
 * ดึง subscription ล่าสุดจาก Stripe แล้วเขียน users/{uid}.subscription
 * กัน subscription ที่ไม่ใช่ตัวปัจจุบันมาเขียนทับตัวที่ใช้อยู่ (ตัวที่บันทึกไว้ต้องยืนยันกับ Stripe ว่ายังมีชีวิตจริง)
 */
async function syncSubscription(
    ctx: Ctx,
    subscriptionId: string,
    opts: { uidHint?: string | null; paymentFailedAt?: Timestamp; clearPaymentFailed?: boolean },
): Promise<{ uid: string; newlyFailed: boolean } | null> {
    const { stripe, db, event } = ctx;
    if (!subscriptionId) return null;

    const sub = await retrieveSubscription(stripe, subscriptionId);
    if (!sub) {
        console.warn(`Subscription ${subscriptionId} not found in Stripe`);
        return null;
    }
    if (!isCapdealProduct(sub.metadata)) {
        console.warn(`Subscription ${sub.id} is not ${CAPDEAL_PRODUCT} — ignored`);
        return null;
    }

    const customerId = idOf(sub.customer as any);
    // uid ใน metadata ของ subscription มาจาก token ตอนสร้าง Checkout — เชื่อได้มากกว่าค่าจาก session
    const userRef = await findUserRef(db, sub.metadata?.uid ?? opts.uidHint ?? null, customerId);
    if (!userRef) {
        await writeBillingAlert(db, {
            type: 'user_not_found', eventId: event.id, eventType: event.type, subscriptionId: sub.id, customerId,
        });
        return null;
    }

    const price = priceOf(sub);
    const planId = planIdForPriceId(price?.id);
    if (!planId) {
        // ห้ามเดาแพลน — ไม่ให้สิทธิ์ แจ้งแอดมิน
        await writeBillingAlert(db, {
            type: 'unknown_price', eventId: event.id, eventType: event.type,
            uid: userRef.id, subscriptionId: sub.id, customerId, priceId: price?.id ?? null,
        });
    }

    // ตัวที่บันทึกไว้เป็นคนละตัวและดูเหมือนยังมีชีวิต → ยืนยันกับ Stripe ก่อน (Firestore อาจค้างจาก event ที่มาไม่ตามลำดับ)
    const before = (await userRef.get()).data()?.subscription ?? {};
    let currentStillLive = false;
    if (before.subscriptionId && before.subscriptionId !== sub.id && hasLiveSubscription(before)) {
        const current = await retrieveSubscription(stripe, before.subscriptionId);
        currentStillLive = !!current && isLiveStatus(current.status);
    }

    const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const current = snap.data()?.subscription ?? {};
        if ((current.subscriptionId ?? null) !== (before.subscriptionId ?? null)) {
            // มีอีก event เขียนตัดหน้า — throw ให้ Stripe retry แล้วตัดสินใหม่
            throw new Error('users.subscription changed concurrently');
        }

        const decision = decideSubscriptionWrite(current.subscriptionId, currentStillLive, sub);
        if (decision !== 'write') return { decision, newlyFailed: false };

        const sameSub = current.subscriptionId === sub.id;
        const { start, end } = periodOf(sub);
        const pastDueSince = nextPastDueSince(sub.status, sameSub ? toMillis(current.pastDueSince) : null);

        const update: Record<string, unknown> = {
            planId: planId ?? null,
            priceId: price?.id ?? null,
            billingInterval: price?.recurring?.interval ?? null,
            status: sub.status,
            subscriptionId: sub.id,
            customerId,
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
            currentPeriodStart: start,
            currentPeriodEnd: end,
            pastDueSince: pastDueSince ? Timestamp.fromMillis(pastDueSince) : FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        let newlyFailed = false;
        if (opts.clearPaymentFailed || !sameSub) {
            update.paymentFailedAt = FieldValue.delete();
        }
        if (opts.paymentFailedAt) {
            const already = sameSub && current.paymentFailedAt;
            if (!already) {
                update.paymentFailedAt = opts.paymentFailedAt;
                newlyFailed = true;
            }
        }

        tx.set(userRef, { subscription: update }, { merge: true });
        return { decision, newlyFailed };
    });

    if (result.decision === 'duplicate') {
        // สมัครซ้ำ — ไม่เขียนทับ ไม่ยกเลิกเอง (key อ่าน Subscriptions ได้อย่างเดียว) ให้แอดมินยกเลิก+คืนเงิน
        await writeBillingAlert(db, {
            type: 'duplicate_subscription', eventId: event.id, eventType: event.type,
            uid: userRef.id, subscriptionId: sub.id, otherSubscriptionId: before.subscriptionId ?? null, customerId,
        });
        return null;
    }
    if (result.decision === 'skip_non_current') {
        console.warn(`Ignoring non-current subscription ${sub.id}`);
        return null;
    }
    return { uid: userRef.id, newlyFailed: result.newlyFailed };
}
