import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Briefcase, Languages } from 'lucide-react';
import { FadeIn } from '@/components/fade-in';
import interpreterHero from '@/pic/lawslane-interpreter.webp';

/**
 * แนะนำบริการในเครือ Lawslane: ล่ามกฎหมาย + รับสมัครทนาย/ล่าม
 * ลิงก์ไปเว็บหลัก (www.lawslane.com) ตามภาษาที่เลือก — สี slate-900 แบบ hero เว็บหลัก
 */
export async function LawslaneNetworkSection({ locale }: { locale: string }) {
    const t = await getTranslations('LawslaneNetwork');
    const main = `https://www.lawslane.com/${['th', 'en', 'zh'].includes(locale) ? locale : 'th'}`;

    const cards = [
        { icon: Briefcase, title: t('lawyerTitle'), text: t('lawyerText'), cta: t('lawyerCta'), href: `${main}/for-lawyers` },
        { icon: Languages, title: t('interpreterTitle'), text: t('interpreterText'), cta: t('interpreterCta'), href: `${main}/for-interpreters` },
    ];

    return (
        <section className="py-20 bg-slate-50">
            <div className="container mx-auto px-4 md:px-6 max-w-6xl space-y-10">
                {/* แบนเนอร์ล่ามกฎหมาย */}
                <FadeIn direction="up">
                    <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white md:grid md:grid-cols-[1fr_auto] md:items-end md:gap-8">
                        <div className="md:hidden relative h-[240px]">
                            <Image src={interpreterHero} alt="" fill sizes="100vw" className="object-contain object-top opacity-80" />
                            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-900 to-transparent" />
                        </div>
                        <div className="relative px-6 pb-10 -mt-6 text-center md:mt-0 md:py-14 md:pl-12 md:text-left">
                            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400">Lawslane</p>
                            <h2 className="mt-2 text-3xl md:text-4xl font-bold font-headline">{t('bannerTitle')}</h2>
                            <p className="mt-3 text-gray-300 max-w-xl mx-auto md:mx-0">{t('bannerText')}</p>
                            <a
                                href={`${main}/interpreters`}
                                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 h-11 font-bold text-slate-900 hover:bg-slate-100 transition-colors"
                            >
                                {t('bannerCta')} <ArrowRight className="w-4 h-4" />
                            </a>
                        </div>
                        <Image src={interpreterHero} alt="" sizes="260px" className="hidden md:block w-[220px] lg:w-[260px] h-auto mr-8" />
                    </div>
                </FadeIn>

                {/* ร่วมงานกับ Lawslane */}
                <div>
                    <FadeIn direction="up">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 font-headline">{t('joinTitle')}</h2>
                            <p className="mt-3 text-slate-600">{t('joinText')}</p>
                        </div>
                    </FadeIn>
                    <div className="grid md:grid-cols-2 gap-6">
                        {cards.map(({ icon: Icon, title, text, cta, href }, i) => (
                            <FadeIn key={href} direction="up" delay={i * 150} className="h-full">
                                <div className="h-full rounded-3xl bg-white border border-slate-100 shadow-sm p-8 flex flex-col">
                                    <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-4">
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl md:text-2xl font-bold text-slate-900">{title}</h3>
                                    <p className="mt-2 text-slate-600 flex-1">{text}</p>
                                    <a href={href} className="mt-6 inline-flex items-center gap-2 self-start rounded-full bg-slate-900 text-white font-bold px-6 h-11 hover:bg-slate-800 transition-colors">
                                        {cta} <ArrowRight className="w-4 h-4" />
                                    </a>
                                </div>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
