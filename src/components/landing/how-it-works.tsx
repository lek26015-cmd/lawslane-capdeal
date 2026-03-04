'use client';

import React from 'react';
import { Camera, Cpu, FileCheck, ArrowRight } from 'lucide-react';
import { FadeIn } from '@/components/fade-in';
import { useTranslations } from 'next-intl';

export function HowItWorks() {
    const t = useTranslations('HomePage');

    const steps = [
        {
            icon: <Camera className="w-10 h-10 text-amber-500" />,
            title: t('howItWorks.steps.1.title'),
            description: t('howItWorks.steps.1.description')
        },
        {
            icon: <Cpu className="w-10 h-10 text-blue-500" />,
            title: t('howItWorks.steps.2.title'),
            description: t('howItWorks.steps.2.description')
        },
        {
            icon: <FileCheck className="w-10 h-10 text-emerald-500" />,
            title: t('howItWorks.steps.3.title'),
            description: t('howItWorks.steps.3.description')
        }
    ];

    return (
        <section className="py-24 bg-white">
            <div className="container mx-auto px-4 md:px-6">
                <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
                    <FadeIn direction="up">
                        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 font-headline">
                            {t('howItWorks.title')}
                        </h2>
                    </FadeIn>
                    <FadeIn direction="up" delay={200}>
                        <p className="text-lg text-slate-600">
                            {t('howItWorks.subtitle')}
                        </p>
                    </FadeIn>
                </div>

                <div className="relative">
                    {/* Connector Line (Hidden on mobile) */}
                    <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />

                    <div className="grid lg:grid-cols-3 gap-12 relative z-10">
                        {steps.map((step, index) => (
                            <FadeIn key={index} direction="up" delay={index * 200}>
                                <div className="flex flex-col items-center text-center space-y-6 group">
                                    <div className="w-24 h-24 rounded-3xl bg-white shadow-xl shadow-slate-200/50 flex items-center justify-center border border-slate-100 group-hover:scale-110 group-hover:shadow-2xl transition-all duration-500 ring-4 ring-slate-50">
                                        {step.icon}
                                    </div>
                                    <div className="space-y-3">
                                        <h3 className="text-2xl font-bold text-slate-900">
                                            {step.title}
                                        </h3>
                                        <p className="text-slate-600 leading-relaxed font-light max-w-sm mx-auto">
                                            {step.description}
                                        </p>
                                    </div>
                                </div>
                            </FadeIn>
                        ))}
                    </div>
                </div>

                <FadeIn direction="up" delay={800} className="mt-20 text-center">
                    <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 font-medium">
                        <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                        {t('howItWorks.freeTier')}
                    </div>
                </FadeIn>
            </div>
        </section>
    );
}
