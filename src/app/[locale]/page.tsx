import { locales } from '@/navigation';
import { useTranslations } from 'next-intl';

import { FadeIn } from '@/components/fade-in';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LandingHero } from '@/components/landing/landing-hero';
import { FeaturesShowcase } from '@/components/landing/features-showcase';
import { FeaturesGrid } from '@/components/landing/features-grid';
import { ContactSection } from '@/components/landing/contact-section';
import { PricingCards } from '@/components/pricing/pricing-cards';
import { initializeFirebase } from '@/firebase';
// import { HowItWorks } from '@/components/landing/how-it-works';

export const dynamic = 'error';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('HomePage');
  initializeFirebase();

  return (
    <>
      <div className="flex flex-col">
        {/* Premium Landing Hero */}
        <LandingHero />

        {/* New Visual Features Showcase (Replaces How it Works) */}
        <FeaturesShowcase />

        {/* Features Showcase Details */}
        <FeaturesGrid />

        {/* Pricing Section Integrated */}
        <section id="pricing" className="py-24 bg-white relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
              <FadeIn direction="up">
                <h2 className="text-3xl md:text-5xl font-bold text-slate-900 font-headline">
                  {t('pricing.title')}
                </h2>
              </FadeIn>
              <FadeIn direction="up" delay={200}>
                <p className="text-lg text-slate-600">
                  {t('pricing.subtitle')}
                </p>
              </FadeIn>
            </div>

            <PricingCards />
          </div>
        </section>

        {/* New Contact Section */}
        <ContactSection />
      </div>
    </>
  );
}