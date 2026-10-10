'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { Link } from '@/navigation';
import { useUser, useFirestore } from '@/firebase';
import { authHeaders } from '@/lib/billing-client';

/**
 * หน้ากลับจาก Stripe Checkout — แสดงผลอย่างเดียว ไม่ให้สิทธิ์อะไร (สิทธิ์มาจาก webhook)
 *
 * เดิมเห็น session 'complete' ก็ขึ้น "สำเร็จ" ทันที ทั้งที่ webhook อาจยังไม่มา ผู้ใช้กดไปสร้างสัญญา
 * แล้วยังติดลิมิต free · ตอนนี้รอจน users/{uid}.subscription เปลี่ยนเป็นแพลนที่ซื้อจริงก่อน
 * (ฟัง Firestore + หมดเวลา 60 วินาที แล้วบอกให้ตรวจที่หน้าบัญชีภายหลัง)
 */
const WAIT_TIMEOUT_MS = 60 * 1000;

type ViewState = 'checking' | 'waiting' | 'success' | 'incomplete' | 'timeout' | 'error';

function CheckoutReturnContent() {
    const searchParams = useSearchParams();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const [view, setView] = useState<ViewState>('checking');
    const [expectedPlan, setExpectedPlan] = useState<string | null>(null);
    const sessionId = searchParams.get('session_id');

    // 1) ถาม server ว่า session นี้ (ของเราเอง) จ่ายครบหรือยัง
    useEffect(() => {
        if (!sessionId || isUserLoading || !user) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`, {
                    headers: await authHeaders(user),
                    cache: 'no-store',
                });
                if (!res.ok) throw new Error(String(res.status));
                const data = await res.json();
                if (cancelled) return;
                if (data.status === 'complete') {
                    setExpectedPlan(typeof data.planId === 'string' ? data.planId : null);
                    setView('waiting');
                } else {
                    setView('incomplete');
                }
            } catch {
                if (!cancelled) setView('error');
            }
        })();
        return () => { cancelled = true; };
    }, [sessionId, user, isUserLoading]);

    // 2) รอ webhook เขียน Firestore จริง
    useEffect(() => {
        if (view !== 'waiting' || !user || !firestore) return;
        const timer = setTimeout(() => setView((v) => (v === 'waiting' ? 'timeout' : v)), WAIT_TIMEOUT_MS);
        const unsub = onSnapshot(
            doc(firestore, 'users', user.uid),
            (snap) => {
                const sub = snap.data()?.subscription;
                const live = sub && (sub.status === 'active' || sub.status === 'trialing');
                if (live && (!expectedPlan || sub.planId === expectedPlan)) setView('success');
            },
            () => setView((v) => (v === 'waiting' ? 'timeout' : v)),
        );
        return () => { clearTimeout(timer); unsub(); };
    }, [view, user, firestore, expectedPlan]);

    if (!sessionId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <XCircle className="h-16 w-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Invalid Session</h1>
                <p className="text-muted-foreground mb-6">No session ID was provided.</p>
                <Link href="/pricing">
                    <Button>Back to Pricing</Button>
                </Link>
            </div>
        );
    }

    if (!isUserLoading && !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <p className="text-muted-foreground mb-6">กรุณาเข้าสู่ระบบเพื่อดูสถานะการชำระเงิน</p>
                <Link href="/login">
                    <Button>เข้าสู่ระบบ</Button>
                </Link>
            </div>
        );
    }

    if (view === 'incomplete') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <XCircle className="h-16 w-16 text-amber-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Payment Incomplete</h1>
                <p className="text-muted-foreground mb-6">
                    การชำระเงินยังไม่เสร็จสมบูรณ์ หรือถูกยกเลิก
                </p>
                <Link href="/pricing">
                    <Button variant="outline">Try Again</Button>
                </Link>
            </div>
        );
    }

    if (view === 'success') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-4" />
                <h1 className="text-3xl font-bold mb-2">Subscription Successful!</h1>
                <p className="text-muted-foreground mb-6 max-w-md">
                    Thank you for subscribing to Lawslane CapDeal. แพ็กเกจของคุณพร้อมใช้งานแล้ว
                </p>
                <div className="flex gap-4">
                    <Link href="/dashboard">
                        <Button>Go to Dashboard</Button>
                    </Link>
                    <Link href="/">
                        <Button variant="outline">Home</Button>
                    </Link>
                </div>
            </div>
        );
    }

    if (view === 'timeout' || view === 'error') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <Clock className="h-16 w-16 text-amber-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">กำลังยืนยันการชำระเงิน</h1>
                <p className="text-muted-foreground mb-6 max-w-md">
                    ระบบยังไม่ได้รับการยืนยันจาก Stripe ภายในเวลาที่กำหนด หากชำระเงินแล้ว แพ็กเกจจะเปิดใช้งาน
                    อัตโนมัติภายในไม่กี่นาที ตรวจสอบได้ที่หน้า &quot;บัญชีของฉัน&quot; (ไม่ต้องชำระซ้ำ)
                </p>
                <Link href="/account">
                    <Button variant="outline">ไปที่บัญชีของฉัน</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <p className="text-lg">Verifying your payment status...</p>
        </div>
    );
}

export default function CheckoutReturnPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <p className="text-lg">Loading payment status...</p>
            </div>
        }>
            <CheckoutReturnContent />
        </Suspense>
    );
}
