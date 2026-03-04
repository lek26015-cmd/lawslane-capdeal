'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, Zap, Scale, FileText, Users, MessageSquare } from 'lucide-react';
import { FadeIn } from '@/components/fade-in';
import { useTranslations } from 'next-intl';

export function FeaturesGrid() {
    const t = useTranslations('HomePage');

    const features = [
        {
            icon: <Zap className="w-8 h-8 text-amber-500" />,
            title: t('mainFeatures.anywhere.title'),
            description: t('mainFeatures.anywhere.description')
        },
        {
            icon: <ShieldCheck className="w-8 h-8 text-blue-500" />,
            title: t('mainFeatures.privacy.title'),
            description: t('mainFeatures.privacy.description')
        },
        {
            icon: <Scale className="w-8 h-8 text-emerald-500" />,
            title: t('capAndDeal.features.legal'),
            description: t('capAndDeal.features.ai') // Reusing for diversity or can add specific template description
        },
        {
            icon: <FileText className="w-8 h-8 text-purple-500" />,
            title: t('features.items.pdf.title'),
            description: t('features.items.pdf.description')
        },
        {
            icon: <Users className="w-8 h-8 text-orange-500" />,
            title: t('mainFeatures.quality.title'),
            description: t('mainFeatures.quality.description')
        },
        {
            icon: <MessageSquare className="w-8 h-8 text-pink-500" />,
            title: t('features.items.chat.title'),
            description: t('features.items.chat.description')
        }
    ];

    return (
        <section className="py-24 bg-slate-50 overflow-hidden">
            <div className="container mx-auto px-4 md:px-6">
                <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                    <FadeIn direction="up">
                        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 font-headline">
                            {t('features.title')}
                        </h2>
                    </FadeIn>
                    <FadeIn direction="up" delay={200}>
                        <p className="text-lg text-slate-600">
                            {t('features.subtitle')}
                        </p>
                    </FadeIn>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <FadeIn key={index} direction="up" delay={index * 100}>
                            <Card className="group relative h-full bg-white/80 backdrop-blur-sm border-white/40 shadow-xl shadow-slate-200/50 rounded-[2rem] hover:rounded-[1.5rem] transition-all duration-500 hover:shadow-2xl hover:shadow-blue-900/10 border-none ring-1 ring-black/5 overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <CardContent className="p-8 relative z-10 flex flex-col items-start space-y-4">
                                    <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                                        {feature.icon}
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                        {feature.title}
                                    </h3>
                                    <p className="text-slate-600 leading-relaxed font-light text-base">
                                        {feature.description}
                                    </p>
                                </CardContent>
                            </Card>
                        </FadeIn>
                    ))}
                </div>
            </div>
        </section>
    );
}
