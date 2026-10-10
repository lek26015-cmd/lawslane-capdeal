'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@/firebase';
import { Link } from '@/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2, XCircle } from 'lucide-react';
import { authHeaders, openBillingPortal } from '@/lib/billing-client';

/**
 * พาไปหน้าชำระเงินที่ Stripe โฮสต์ (PLAN-08 หลักข้อ 1: ห้ามทำฟอร์มบัตรเอง)
 * server สร้าง/ใช้ Checkout Session เดิมแล้วคืน URL — หน้านี้แค่ redirect
 */
function CheckoutContent() {
    const searchParams = useSearchParams();
    const { user, isUserLoading } = useUser();
    const [error, setError] = useState<string | null>(null);
    const [alreadySubscribed, setAlreadySubscribed] = useState(false);
    const started = useRef(false);

    const planId = searchParams.get('planId');
    const billingInterval = searchParams.get('interval') === 'year' ? 'year' : 'month';

    useEffect(() => {
        if (isUserLoading || !user || !planId || started.current) return;
        started.current = true;

        (async () => {
            try {
                const response = await fetch('/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(await authHeaders(user)) },
                    // server ดึง uid และอีเมลจาก token เอง — ห้ามให้ client กำหนดว่าใครได้แพลน
                    body: JSON.stringify({
                        planId,
                        billingInterval,
                        locale: window.location.pathname.split('/')[1],
                    }),
                });
                const data = await response.json().catch(() => ({}));
                if (response.ok && typeof data.url === 'string') {
                    window.location.assign(data.url);
                    return;
                }
                if (data.code === 'already_subscribed') setAlreadySubscribed(true);
                setError(typeof data.error === 'string' ? data.error : 'ไม่สามารถเริ่มการชำระเงินได้ กรุณาลองใหม่อีกครั้ง');
            } catch {
                setError('ไม่สามารถเริ่มการชำระเงินได้ กรุณาลองใหม่อีกครั้ง');
            }
        })();
    }, [user, isUserLoading, planId, billingInterval]);

    if (!planId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
                <h1 className="text-2xl font-bold mb-4">No plan selected</h1>
                <Link href="/pricing">
                    <Button variant="outline">
                        <ChevronLeft className="mr-2 h-4 w-4" /> Back to Pricing
                    </Button>
                </Link>
            </div>
        );
    }

    if (!isUserLoading && !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
                <h1 className="text-2xl font-bold mb-4">กรุณาเข้าสู่ระบบก่อนสมัครแพ็กเกจ</h1>
                <Link href="/login">
                    <Button>เข้าสู่ระบบ</Button>
                </Link>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
                <XCircle className="h-12 w-12 text-red-500 mb-4" />
                <p className="mb-6 text-muted-foreground max-w-md">{error}</p>
                <div className="flex gap-3">
                    {alreadySubscribed && user && (
                        <Button onClick={() => openBillingPortal(user).catch(() => setError('เปิด Billing Portal ไม่สำเร็จ กรุณาลองใหม่'))}>
                            Billing Portal
                        </Button>
                    )}
                    <Link href="/pricing">
                        <Button variant="outline">Back to Pricing</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-4 text-center">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-muted-foreground">กำลังพาไปหน้าชำระเงินของ Stripe...</p>
            <p className="text-xs text-muted-foreground">Your payment information is processed securely by Stripe.</p>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>Loading checkout...</p>
            </div>
        }>
            <CheckoutContent />
        </Suspense>
    );
}
