'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { FadeIn } from '@/components/fade-in';
import { Search, MessageSquare, Sparkles, CheckCircle2 } from 'lucide-react';

export function FeaturesShowcase() {
    const t = useTranslations('HomePage');

    return (
        <section className="py-24 bg-slate-50 overflow-hidden">
            <div className="container mx-auto px-4 md:px-6">
                <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                    <FadeIn direction="up">
                        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 font-headline">
                            {t('featuresShowcase.title')}
                        </h2>
                    </FadeIn>
                    <FadeIn direction="up" delay={200}>
                        <p className="text-lg text-slate-600">
                            {t('featuresShowcase.subtitle')}
                        </p>
                    </FadeIn>
                </div>

                {/* Combined Single Large Card */}
                <FadeIn direction="up">
                    <div className="bg-[#f8f9fb] rounded-[3rem] p-8 md:p-16 border border-slate-100 shadow-xl shadow-slate-200/50 relative overflow-hidden group">
                        <div className="grid lg:grid-cols-2 gap-12 items-center relative z-10">

                            {/* Left Side: LINE Chat Simulation */}
                            <div className="space-y-8 order-1 lg:order-1">
                                <div className="space-y-4">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                                        Step 1: Cap
                                    </div>
                                    <h3 className="text-3xl font-bold text-slate-900 font-headline">
                                        {t('featuresShowcase.card1.title')}
                                    </h3>
                                    <p className="text-slate-600 font-light text-lg max-w-md">
                                        {t('featuresShowcase.card1.description')}
                                    </p>
                                </div>

                                <div className="relative mx-auto lg:mx-0 w-full max-w-[280px]">
                                    <div className="relative aspect-[9/18.5] bg-slate-900 rounded-[2.5rem] border-[6px] border-slate-800 shadow-2xl overflow-hidden ring-4 ring-slate-100">
                                        {/* Notch */}
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-800 rounded-b-xl z-20" />

                                        {/* LINE Chat Content */}
                                        <div className="absolute inset-0 bg-[#7494C0] flex flex-col pt-8">
                                            <div className="bg-white/10 backdrop-blur-md p-3 flex items-center gap-2 border-b border-white/5">
                                                <div className="w-8 h-8 rounded-full bg-slate-300" />
                                                <div className="text-xs font-bold text-white">CapDeal AI</div>
                                            </div>

                                            <div className="flex-1 p-4 flex flex-col gap-4 overflow-hidden">
                                                {/* Initial User Message */}
                                                <motion.div
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 500 }}
                                                    className="bg-[#D9F1FF] text-[#0a1128] rounded-2xl rounded-tr-none p-3 self-end max-w-[85%] shadow-sm text-[10px] leading-tight"
                                                >
                                                    ต้องการทำสัญญาซื้อขายรถยนต์ครับ รายละเอียดตามนี้เลย
                                                </motion.div>

                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 1000 }}
                                                    className="bg-white rounded-2xl rounded-tl-none p-1.5 self-start max-w-[85%] shadow-sm"
                                                >
                                                    <div className="bg-slate-100 rounded-xl aspect-[3/4] flex items-center justify-center overflow-hidden">
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center px-4">
                                                            [ Screenshot ]
                                                        </div>
                                                    </div>
                                                </motion.div>

                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 2000 }}
                                                    className="bg-[#06C755] text-white rounded-2xl rounded-tr-none p-3 self-end shadow-md flex items-center gap-2"
                                                >
                                                    <Sparkles className="w-4 h-4 text-white animate-pulse" />
                                                    <div className="text-[10px] font-bold">Analyzing...</div>
                                                </motion.div>

                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: 3500 }}
                                                    className="bg-white rounded-2xl rounded-tl-none p-4 self-start w-[90%] shadow-lg"
                                                >
                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                        <div className="text-[10px] font-bold text-slate-900">Contract Ready</div>
                                                    </div>
                                                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: "100%" }}
                                                            transition={{ delay: 4000, duration: 2 }}
                                                            className="h-full bg-emerald-500"
                                                        />
                                                    </div>
                                                </motion.div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Floating LINE-style Icon */}
                                    <div className="absolute -left-10 top-1/2 -translate-y-1/2 w-20 h-20 bg-[#06C755] rounded-full shadow-2xl flex items-center justify-center text-white border-4 border-white animate-bounce">
                                        <div className="text-2xl font-black italic tracking-tighter">LINE</div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: AI Data Snippet */}
                            <div className="space-y-8 order-2 lg:order-2">
                                <div className="space-y-4">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">
                                        Step 2: Deal
                                    </div>
                                    <h3 className="text-3xl font-bold text-slate-900 font-headline">
                                        {t('featuresShowcase.card2.title')}
                                    </h3>
                                    <p className="text-slate-600 font-light text-lg max-w-md">
                                        {t('featuresShowcase.card2.description')}
                                    </p>
                                </div>

                                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl p-6 md:p-10 space-y-8 relative">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                                                <Sparkles className="w-6 h-6" />
                                            </div>
                                            <div className="text-xl font-bold text-slate-900">บันทึกข้อมูลสัญญาแล้ว</div>
                                        </div>
                                        <div className="relative">
                                            <motion.div
                                                animate={{ scale: [1, 1.2, 1] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                                className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600"
                                            >
                                                <Search className="w-6 h-6" />
                                            </motion.div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100/50 space-y-3">
                                            <div className="text-[11px] font-bold text-amber-800 uppercase tracking-widest flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                ตรวจพบข้อมูลสำคัญ
                                            </div>
                                            <div className="text-lg font-bold text-amber-900">
                                                ชื่อผู้ขาย: นายสมชาย ใจดี
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-1.5">
                                                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">จำนวนเงิน</div>
                                                <div className="text-2xl font-bold text-slate-900">150,000 THB</div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">วันที่ทำสัญญา</div>
                                                <div className="text-xl font-bold text-slate-900">24 ก.ย. 2568</div>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">ประเภทการทำรายการ</div>
                                            <div className="text-lg font-bold text-slate-900">ซื้อขายรถยนต์มือสอง (Second-hand Car Sale)</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Background Decorative Elements */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
                    </div>
                </FadeIn>
            </div>
        </section>
    );
}
