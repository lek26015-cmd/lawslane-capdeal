'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Zap, ExternalLink, Loader2, Wallet, CheckCircle2 } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useUser } from '@/firebase';
import { Link } from '@/navigation';
import { cn } from '@/lib/utils';

export function SubscriptionCard() {
    const { user } = useUser();
    const { plan, casesThisMonth, dealsLimit, isLoading, isActive, planId } = useSubscription();
    const [isPortalLoading, setIsPortalLoading] = useState(false);
    const [isSetupLoading, setIsSetupLoading] = useState(false);

    const usagePercentage = Math.min((casesThisMonth / dealsLimit) * 100, 100);
    const isOverLimit = casesThisMonth >= dealsLimit;

    const handleManageSubscription = async () => {
        if (!user) return;

        try {
            setIsPortalLoading(true);
            const response = await fetch('/api/portal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid }),
            });

            const contentType = response.headers.get('content-type');
            if (response.ok && contentType && contentType.includes('application/json')) {
                const { url } = await response.json();
                window.location.href = url;
            } else {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to create portal session');
            }
        } catch (error) {
            console.error('PORTAL_ERROR', error);
        } finally {
            setIsPortalLoading(false);
        }
    };

    const handleLinkCard = async () => {
        if (!user) return;

        try {
            if (isActive) {
                // Active subscribers: use billing portal (includes payment method management)
                await handleManageSubscription();
                return;
            }

            // Non-subscribers: use setup intent flow
            setIsSetupLoading(true);
            const response = await fetch('/api/setup-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid, email: user.email }),
            });

            const contentType = response.headers.get('content-type');
            if (response.ok && contentType && contentType.includes('application/json')) {
                const { url } = await response.json();
                window.location.href = url;
            } else {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to create setup session');
            }
        } catch (error) {
            console.error('SETUP_INTENT_ERROR', error);
        } finally {
            setIsSetupLoading(false);
        }
    };

    if (isLoading) {
        return (
            <Card className="rounded-3xl shadow-sm border-none">
                <CardContent className="h-40 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="rounded-3xl shadow-sm border-none overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between pb-8 p-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-400/20 flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <CardTitle className="text-xl font-headline">แพ็กเกจการใช้งาน</CardTitle>
                        <CardDescription className="text-slate-400">จัดการการสมัครสมาชิกและตรวจสอบการใช้งาน</CardDescription>
                    </div>
                </div>
                <Badge variant="secondary" className="bg-amber-400 text-slate-900 font-bold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-lg shadow-amber-400/20">
                    {plan.name}
                </Badge>
            </CardHeader>
            <CardContent className="space-y-8 pt-8 p-8">
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <div className="space-y-1">
                            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">โควตาการใช้งานรายเดือน</span>
                            <p className="text-2xl font-bold text-slate-900">
                                {casesThisMonth} <span className="text-slate-400 text-lg font-medium">/ {dealsLimit} สัญญา</span>
                            </p>
                        </div>
                        <div className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold",
                            isOverLimit ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                        )}>
                            {isOverLimit ? 'เกินขีดจำกัด' : 'ปกติ'}
                        </div>
                    </div>
                    <Progress value={usagePercentage} className={cn("h-3 rounded-full", isOverLimit ? "bg-red-100" : "bg-slate-100")} />
                    <p className="text-sm text-slate-500 flex items-center gap-2">
                        {isOverLimit
                            ? "คุณใช้งานเกินขีดจำกัดแล้ว กรุณาอัปเกรดเพื่อใช้งานต่อ"
                            : `เหลือสิทธิ์การวิเคราะห์อีก ${dealsLimit - casesThisMonth} สัญญาในรอบเดือนนี้`}
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Button
                            onClick={handleManageSubscription}
                            disabled={isPortalLoading || !profile?.subscription?.customerId}
                            variant="outline"
                            className="h-14 rounded-2xl border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all font-semibold"
                        >
                            {isPortalLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wallet className="mr-2 h-5 w-5 text-slate-400" />}
                            จัดการการชำระเงิน
                        </Button>

                        {!isActive ? (
                            <Button asChild className="h-14 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all font-bold">
                                <Link href="/pricing" className="flex items-center justify-center">
                                    <Zap className="mr-2 h-5 w-5 fill-amber-400 text-amber-400" />
                                    อัปเกรดแพ็กเกจ
                                </Link>
                            </Button>
                        ) : (
                            <Button variant="ghost" className="h-14 rounded-2xl text-slate-500 font-medium" disabled>
                                <CheckCircle2 className="mr-2 h-5 w-5 text-emerald-500" />
                                เปิดใช้งานแล้ว
                            </Button>
                        )}
                    </div>
                    
                    {!profile?.subscription?.customerId && (
                        <p className="text-[11px] text-center text-slate-400 mt-2">
                            คุณยังไม่มีข้อมูลการชำระเงิน กรุณาสมัครแพ็กเกจเพื่อเริ่มจัดการการชำระเงิน
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
