'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '@/components/fade-in';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Mail, Phone, MapPin, Send } from 'lucide-react';
import { initializeFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export function ContactSection() {
    const t = useTranslations('contactSection');
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        message: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { firestore: db } = initializeFirebase();
            if (!db) throw new Error("Firestore not initialized");

            await addDoc(collection(db, 'contactRequests'), {
                ...formData,
                source: 'landing_page',
                status: 'new',
                createdAt: serverTimestamp(),
            });

            setIsSuccess(true);
            toast({
                title: t('successTitle'),
                description: t('successDesc'),
            });

            // Reset form after success
            setFormData({ name: '', email: '', phone: '', message: '' });
        } catch (error) {
            console.error("Error submitting contact form:", error);
            toast({
                title: "Error",
                description: "Failed to send message. Please try again later.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className="py-24 bg-white overflow-hidden relative" id="contact">
            {/* Background Accents */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 opacity-50" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-50 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 opacity-50" />

            <div className="container mx-auto px-4 md:px-6 relative z-10">
                <div className="grid lg:grid-cols-2 gap-16 items-start">

                    {/* Left Side: Info & Text */}
                    <div className="space-y-10">
                        <div className="space-y-4">
                            <FadeIn direction="up">
                                <h2 className="text-3xl md:text-5xl font-bold text-slate-900 font-headline">
                                    {t('title')}
                                </h2>
                            </FadeIn>
                            <FadeIn direction="up" delay={200}>
                                <p className="text-xl text-slate-600 font-light leading-relaxed max-w-lg">
                                    {t('subtitle')}
                                </p>
                            </FadeIn>
                        </div>

                        <div className="space-y-6">
                            <FadeIn direction="up" delay={400} className="flex items-center gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Email</p>
                                    <p className="text-lg font-medium text-slate-900">contact@lawslane.com</p>
                                </div>
                            </FadeIn>

                            <FadeIn direction="up" delay={500} className="flex items-center gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                                    <Phone className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Phone</p>
                                    <p className="text-lg font-medium text-slate-900">{t('phoneValue')}</p>
                                </div>
                            </FadeIn>

                            <FadeIn direction="up" delay={600} className="flex items-center gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-sm border border-amber-100">
                                    <MapPin className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Office</p>
                                    <p className="text-lg font-medium text-slate-900">{t('officeValue')}</p>
                                </div>
                            </FadeIn>
                        </div>
                    </div>

                    {/* Right Side: Form Card */}
                    <FadeIn direction="right" className="h-full">
                        <div className="bg-[#f8f9fb] rounded-[3rem] p-8 md:p-12 border border-slate-100 shadow-2xl shadow-slate-200/50 relative overflow-hidden">
                            <AnimatePresence mode="wait">
                                {isSuccess ? (
                                    <motion.div
                                        key="success"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="h-full flex flex-col items-center justify-center text-center space-y-6 py-12"
                                    >
                                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2">
                                            <CheckCircle2 className="w-10 h-10" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-bold text-slate-900">{t('successTitle')}</h3>
                                            <p className="text-slate-600 max-w-xs mx-auto">{t('successDesc')}</p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="rounded-xl px-8"
                                            onClick={() => setIsSuccess(false)}
                                        >
                                            Send another message
                                        </Button>
                                    </motion.div>
                                ) : (
                                    <motion.form
                                        key="form"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onSubmit={handleSubmit}
                                        className="space-y-6"
                                    >
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label htmlFor="name" className="text-sm font-bold text-slate-700 ml-1">{t('name')}</label>
                                                <Input
                                                    id="name"
                                                    placeholder={t('placeholder.name')}
                                                    required
                                                    value={formData.name}
                                                    onChange={handleChange}
                                                    className="h-14 bg-white border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 px-5 shadow-sm"
                                                />
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label htmlFor="email" className="text-sm font-bold text-slate-700 ml-1">{t('email')}</label>
                                                    <Input
                                                        id="email"
                                                        type="email"
                                                        placeholder={t('placeholder.email')}
                                                        required
                                                        value={formData.email}
                                                        onChange={handleChange}
                                                        className="h-14 bg-white border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 px-5 shadow-sm"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label htmlFor="phone" className="text-sm font-bold text-slate-700 ml-1">{t('phone')}</label>
                                                    <Input
                                                        id="phone"
                                                        placeholder={t('placeholder.phone')}
                                                        value={formData.phone}
                                                        onChange={handleChange}
                                                        className="h-14 bg-white border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 px-5 shadow-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label htmlFor="message" className="text-sm font-bold text-slate-700 ml-1">{t('message')}</label>
                                                <Textarea
                                                    id="message"
                                                    placeholder={t('placeholder.message')}
                                                    required
                                                    rows={4}
                                                    value={formData.message}
                                                    onChange={handleChange}
                                                    className="bg-white border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 p-5 shadow-sm resize-none"
                                                />
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                    {t('submitting')}
                                                </>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Send className="w-5 h-5" />
                                                    {t('submit')}
                                                </div>
                                            )}
                                        </Button>
                                    </motion.form>
                                )}
                            </AnimatePresence>
                        </div>
                    </FadeIn>
                </div>
            </div>
        </section>
    );
}
