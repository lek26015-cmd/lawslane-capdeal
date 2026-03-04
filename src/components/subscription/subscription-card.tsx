'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Zap, ExternalLink, Loader2 } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useUser } from '@/firebase';
import { Link } from '@/navigation';

export function SubscriptionCard() {
    const { user } = useUser();
    const { plan, casesThisMonth, dealsLimit, isLoading, isActive, planId } = useSubscription();
    const [isPortalLoading, setIsPortalLoading] = useState(false);

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

            if (!response.ok) throw new Error('Failed to create portal session');

            const { url } = await response.json();
            window.location.href = url;
        } catch (error) {
            console.error('PORTAL_ERROR', error);
        } finally {
            setIsPortalLoading(false);
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
        <Card className="rounded-3xl shadow-sm border-none overflow-hidden">
            <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between pb-8">
                <div className="flex items-center gap-4">
                    <CreditCard className="w-6 h-6 text-amber-400" />
                    <div>
                        <CardTitle className="text-xl">Subscription Plan</CardTitle>
                        <CardDescription className="text-slate-400">Manage your current subscription and usage</CardDescription>
                    </div>
                </div>
                <Badge variant="secondary" className="bg-amber-400 text-slate-900 font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                    {plan.name}
                </Badge>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                        <span className="text-slate-600">Monthly Usage (Deals)</span>
                        <span className={`${isOverLimit ? 'text-red-500' : 'text-slate-900'}`}>
                            {casesThisMonth} / {dealsLimit} {isActive ? 'deals' : 'scans'}
                        </span>
                    </div>
                    <Progress value={usagePercentage} className={`h-2 ${isOverLimit ? 'bg-red-100' : 'bg-slate-100'}`} />
                    <p className="text-xs text-muted-foreground pt-1">
                        {isOverLimit
                            ? "You've reached your monthly limit. Upgrade to continue."
                            : `${dealsLimit - casesThisMonth} deals remaining in your current period.`}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    {isActive ? (
                        <Button
                            onClick={handleManageSubscription}
                            disabled={isPortalLoading}
                            variant="outline"
                            className="flex-1 rounded-full border-slate-200 hover:bg-slate-50"
                        >
                            {isPortalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                            Billing Portal
                        </Button>
                    ) : (
                        <Button asChild className="flex-1 rounded-full bg-slate-900 text-white hover:bg-slate-800">
                            <Link href="/pricing" className="flex items-center justify-center">
                                <Zap className="mr-2 h-4 w-4 fill-amber-400 text-amber-400" />
                                Upgrade Plan
                            </Link>
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
