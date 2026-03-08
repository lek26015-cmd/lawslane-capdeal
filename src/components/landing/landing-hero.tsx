'use client';

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/navigation';
import { ArrowRight } from 'lucide-react';
import { FadeIn } from '@/components/fade-in';
import { useTranslations } from 'next-intl';
import { motion, useScroll, useTransform } from 'framer-motion';

export function LandingHero() {
    const t = useTranslations('HomePage');
    const containerRef = useRef<HTMLDivElement>(null);

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end start"]
    });

    // Parallax transforms
    const headingY = useTransform(scrollYProgress, [0, 1], [0, -100]);
    const imageY = useTransform(scrollYProgress, [0, 1], [0, 50]);
    const subtitleY = useTransform(scrollYProgress, [0, 1], [0, -150]);
    const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

    return (
        <section
            ref={containerRef}
            className="relative w-full min-h-[100vh] flex items-start justify-center overflow-hidden bg-[#050b18] pt-32 md:pt-40"
        >
            {/* Background Overlay */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,58,138,0.15),transparent_70%)]" />
            </div>

            {/* Decorative Glows */}
            <div className="absolute top-1/4 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-amber-500/5 rounded-full blur-[120px] animate-pulse delay-700" />

            <div className="container relative z-10 mx-auto px-4 md:px-6 pb-20">
                <div className="max-w-4xl mx-auto text-center flex flex-col items-center">

                    <motion.div style={{ y: headingY, opacity }} className="relative z-0 w-full flex justify-center px-4 sm:px-12">
                        <FadeIn direction="up" delay={200}>
                            <h1 className="text-[17vw] sm:text-7xl md:text-[10rem] lg:text-[12rem] font-bold tracking-tighter text-white font-headline leading-[0.9] drop-shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-80 whitespace-nowrap pt-8 md:pt-16 pb-12 md:pb-24">
                                {t('hero.brandPart1')}<span className="text-[#facc15] drop-shadow-[0_0_25px_rgba(250,204,21,0.5)]">{t('hero.brandPart2')}</span>
                            </h1>
                        </FadeIn>
                    </motion.div>

                    <motion.div
                        style={{ y: imageY }}
                        className="relative z-10 -mt-20 md:-mt-40 w-full max-w-xl px-4"
                    >
                        <FadeIn direction="up" delay={400}>
                            <div className="relative group hover:scale-[1.02] transition-transform duration-1000">
                                {/* Subtle Glow behind image */}
                                <div className="absolute -inset-20 bg-blue-600/5 rounded-full blur-[100px] z-0 opacity-40 pointer-events-none" />

                                <img
                                    src="/images/capdeal_photo.png"
                                    alt="Cap & Deal AI Analysis"
                                    className="w-full h-auto object-contain mx-auto"
                                />
                            </div>
                        </FadeIn>
                    </motion.div>

                    <motion.div style={{ y: subtitleY }} className="relative z-30 -mt-10 md:-mt-20 px-4">
                        <FadeIn direction="up" delay={600}>
                            <p className="max-w-[850px] mx-auto text-white text-xl md:text-2xl font-bold tracking-tight leading-relaxed drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                                {t('hero.subtitle')}
                            </p>
                        </FadeIn>

                        <FadeIn direction="up" delay={800} className="mt-8">
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
                                <Link href="/services/contracts/screenshot">
                                    <Button size="lg" className="h-16 px-10 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#0a1128] text-xl font-bold shadow-[0_10px_30px_rgba(245,158,11,0.4)] transition-all hover:scale-105 active:scale-95">
                                        {t('capAndDeal.cta')}
                                        <ArrowRight className="ml-2 w-6 h-6" />
                                    </Button>
                                </Link>
                                <Link href="/pricing">
                                    <Button size="lg" variant="outline" className="h-16 px-10 rounded-full border-white/20 bg-white/5 backdrop-blur-md text-white hover:bg-white/10 text-xl font-medium transition-all">
                                        {t('hero.viewPricing')}
                                    </Button>
                                </Link>
                            </div>
                        </FadeIn>
                    </motion.div>

                    <FadeIn direction="up" delay={1000} className="relative z-50">
                        <div className="mt-24 inline-flex flex-wrap justify-center items-center gap-x-12 gap-y-8 px-4 sm:px-10 py-5 sm:rounded-full sm:bg-slate-900/40 sm:backdrop-blur-2xl sm:border sm:border-white/10 sm:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                            <div className="flex items-center gap-3 group">
                                <div className="p-3 sm:p-2 rounded-xl bg-blue-500/10 text-blue-400 sm:group-hover:bg-blue-500/20 transition-colors">
                                    <svg className="w-6 h-6 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                </div>
                                <span className="text-sm sm:text-xs font-black tracking-[0.25em] sm:tracking-[0.25em] uppercase text-blue-100/90 sm:group-hover:text-white transition-colors">
                                    {t('hero.trustStripe')}
                                </span>
                            </div>

                            <div className="hidden sm:block w-px h-6 bg-white/10" />

                            <div className="flex items-center gap-3 group">
                                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>
                                </div>
                                <span className="text-xs font-black tracking-[0.25em] uppercase text-amber-100/90 group-hover:text-white transition-colors">
                                    {t('hero.trustAI')}
                                </span>
                            </div>

                            <div className="hidden sm:block w-px h-6 bg-white/10" />

                            <div className="flex items-center gap-3 group">
                                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /></svg>
                                </div>
                                <span className="text-xs font-black tracking-[0.25em] uppercase text-emerald-100/90 group-hover:text-white transition-colors">
                                    {t('hero.trustLegal')}
                                </span>
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </div>

            {/* Modern Gradient Fade to Content */}
            <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-[#050b18] to-transparent z-40" />
        </section>
    );
}
