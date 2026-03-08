'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/navigation';
import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { FadeIn } from '@/components/fade-in';
import { useTranslations } from 'next-intl';

export function LandingHero() {
    const t = useTranslations('HomePage');

    return (
        <section className="relative w-full min-h-[90vh] flex items-start justify-center overflow-hidden bg-gradient-to-b from-[#0a1128] via-[#0f172a] to-[#0a1128] pt-32 md:pt-40">
            {/* Background Overlay */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,58,138,0.2),transparent_70%)]" />
            </div>

            {/* Decorative Glows */}
            <div className="absolute top-1/4 -left-24 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] animate-pulse delay-700" />

            <div className="container relative z-10 mx-auto px-4 md:px-6">
                <div className="max-w-4xl mx-auto text-center space-y-8">


                    <FadeIn direction="up" delay={200}>
                        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-white font-headline leading-[1.1]">
                            {t('hero.brandPart1')}<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-[length:200%_auto] animate-gradient">{t('hero.brandPart2')}</span>
                            <br />
                            <span className="text-3xl md:text-5xl lg:text-6xl text-blue-100/90 font-light">
                                {t('hero.title')}
                            </span>
                        </h1>
                    </FadeIn>

                    <FadeIn direction="up" delay={400}>
                        <p className="max-w-[800px] mx-auto text-blue-100/70 text-lg md:text-xl lg:text-2xl font-light leading-relaxed">
                            {t('hero.subtitle')}
                        </p>
                    </FadeIn>

                    <FadeIn direction="up" delay={600}>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                            <Link href="/services/contracts/screenshot">
                                <Button size="lg" className="h-14 px-8 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#0a1128] text-lg font-bold shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all hover:scale-105 active:scale-95">
                                    {t('capAndDeal.cta')}
                                    <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </Link>
                            <Link href="/pricing">
                                <Button size="lg" variant="outline" className="h-14 px-8 rounded-full border-white/20 bg-white/5 backdrop-blur-md text-white hover:bg-white/10 text-lg font-medium transition-all">
                                    {t('hero.viewPricing')}
                                </Button>
                            </Link>
                        </div>
                    </FadeIn>

                    <FadeIn direction="up" delay={800}>
                        <div className="mt-16 inline-flex flex-wrap justify-center items-center gap-x-8 gap-y-4 px-8 py-4 rounded-full bg-slate-900/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                            <div className="flex items-center gap-2 group transition-all duration-300">
                                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                </div>
                                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-blue-100/90 group-hover:text-white transition-colors">
                                    {t('hero.trustStripe')}
                                </span>
                            </div>

                            <div className="hidden sm:block w-px h-4 bg-white/10" />

                            <div className="flex items-center gap-2 group transition-all duration-300">
                                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>
                                </div>
                                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-amber-100/90 group-hover:text-white transition-colors">
                                    {t('hero.trustAI')}
                                </span>
                            </div>

                            <div className="hidden sm:block w-px h-4 bg-white/10" />

                            <div className="flex items-center gap-2 group transition-all duration-300">
                                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /></svg>
                                </div>
                                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-emerald-100/90 group-hover:text-white transition-colors">
                                    {t('hero.trustLegal')}
                                </span>
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </div>

            {/* Modern Gradient Fade to Content */}
            <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-slate-50 to-transparent" />
        </section>
    );
}
