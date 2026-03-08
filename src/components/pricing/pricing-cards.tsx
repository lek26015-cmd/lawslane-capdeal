'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SUBSCRIPTION_PLANS, PlanId } from '@/lib/subscription';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export function PricingCards() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
    const [isYearly, setIsYearly] = useState(false);

    const t = useTranslations('HomePage.pricing_tiers');
    const tCommon = useTranslations('HomePage.pricing_common');

    const handleSubscribe = async (planId: PlanId) => {
        if (!user) {
            toast({
                title: 'กรุณาเข้าสู่ระบบ',
                description: 'กรุณาเข้าสู่ระบบก่อนสมัครแพ็กเกจ',
                variant: 'destructive',
            });
            router.push('/login');
            return;
        }

        if (planId === 'free') {
            router.push('/services/contracts/screenshot');
            return;
        }

        const interval = isYearly ? 'year' : 'month';
        router.push(`/checkout?planId=${planId}&interval=${interval}`);
    };

    // Filter out free plan from the carousel or showing only 3 main plans like the screenshot if needed
    // But I'll show all 4 for now in a 4-col grid, or 3 if I want to strictly match the screenshot's 'Lite, Starter, Professional'
    // I'll show all because 'Free' is important for Lawslane user onboarding.
    const plans = Object.values(SUBSCRIPTION_PLANS);

    return (
        <div className="flex flex-col items-center w-full max-w-7xl mx-auto px-4 py-12">
            {/* Toggle Switch */}
            <div className="mb-16">
                <div className="bg-slate-100 p-1.5 rounded-full flex items-center gap-1 relative">
                    <button
                        onClick={() => setIsYearly(false)}
                        className={cn(
                            "px-8 py-2.5 rounded-full text-sm font-semibold transition-all relative z-10",
                            !isYearly ? "text-blue-600" : "text-slate-500"
                        )}
                    >
                        {tCommon('monthly')}
                        {!isYearly && (
                            <motion.div
                                layoutId="active-pill"
                                className="absolute inset-0 bg-white rounded-full shadow-sm -z-10"
                                transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
                            />
                        )}
                    </button>
                    <button
                        onClick={() => setIsYearly(true)}
                        className={cn(
                            "px-8 py-2.5 rounded-full text-sm font-semibold transition-all relative z-10 flex items-center gap-2",
                            isYearly ? "text-blue-600" : "text-slate-500"
                        )}
                    >
                        {tCommon('yearly')}
                        <span className="text-emerald-500 font-bold ml-1 text-[11px] uppercase tracking-tight">
                            {tCommon('save_percent')}
                        </span>
                        {isYearly && (
                            <motion.div
                                layoutId="active-pill"
                                className="absolute inset-0 bg-white rounded-full shadow-sm -z-10"
                                transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
                            />
                        )}
                    </button>
                </div>
            </div>

            {/* Pricing Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
                {plans.map((plan) => {
                    const planId = plan.id as PlanId;
                    const localizedFeatures = t.raw(`${planId}.features`) as string[];
                    const isPro = planId === 'pro';
                    const price = isYearly ? plan.yearlyPrice : plan.price;
                    const displayPrice = isYearly ? Math.round(price / 12) : price;

                    return (
                        <Card
                            key={plan.id}
                            className={cn(
                                "flex flex-col border transition-all duration-300 rounded-[2rem] overflow-hidden group",
                                isPro
                                    ? "border-blue-600 ring-1 ring-blue-600 shadow-xl scale-105 z-10 bg-white"
                                    : "border-slate-100 shadow-sm hover:shadow-md bg-white"
                            )}
                        >
                            {isPro && (
                                <div className="bg-blue-600 text-white text-[10px] font-bold uppercase tracking-[0.1em] text-center py-1 absolute top-0 right-0 px-4 rounded-bl-xl z-20">
                                    {t(`${planId}.popular_tag`) || 'ยอดนิยม'}
                                </div>
                            )}

                            <CardHeader className="pt-10 pb-6 px-8">
                                <CardTitle className="text-2xl font-extrabold text-[#0F172A]">
                                    {t(`${planId}.name`) || plan.name}
                                </CardTitle>
                                <CardDescription className="text-sm mt-3 text-slate-400 font-medium leading-relaxed min-h-[40px]">
                                    {t(`${planId}.description`)}
                                </CardDescription>

                                <div className="mt-6 flex items-baseline">
                                    <span className="text-3xl font-bold text-[#0F172A] mr-1">{tCommon('currency')}</span>
                                    <span className="text-5xl font-extrabold text-[#0F172A] tracking-tight">
                                        {displayPrice.toLocaleString()}
                                    </span>
                                    <span className="text-sm font-medium text-slate-400 ml-2">
                                        {tCommon('period')}
                                    </span>
                                </div>
                            </CardHeader>

                            <CardContent className="flex-grow px-8 pb-8">
                                <div className="border-t border-slate-50 pt-8 mt-2">
                                    <ul className="space-y-4">
                                        {(localizedFeatures || plan.features).map((feature, idx) => (
                                            <li key={idx} className="flex items-start gap-4">
                                                <div className="mt-0.5">
                                                    <CheckCircle2 className={cn(
                                                        "h-5 w-5 stroke-[2.5]",
                                                        isPro ? "text-blue-600" : "text-blue-500"
                                                    )} />
                                                </div>
                                                <span className="text-[15px] font-medium text-slate-600 leading-tight">
                                                    {feature}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </CardContent>

                            <CardFooter className="px-8 pb-10">
                                <Button
                                    onClick={() => handleSubscribe(planId)}
                                    disabled={isUserLoading || loadingPlan !== null}
                                    className={cn(
                                        "w-full py-7 text-base font-bold rounded-2xl transition-all duration-300 shadow-sm",
                                        isPro
                                            ? "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg hover:-translate-y-0.5"
                                            : "bg-white border border-slate-200 text-[#0F172A] hover:bg-slate-50 hover:border-slate-300"
                                    )}
                                >
                                    {loadingPlan === planId ? (
                                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                                    ) : (
                                        t(`${planId}.cta`) || 'เริ่มต้นใช้งาน'
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
