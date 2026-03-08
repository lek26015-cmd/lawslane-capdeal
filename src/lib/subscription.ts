export interface SubscriptionPlan {
    id: string;
    name: string;
    price: number;
    yearlyPrice: number;
    interval: 'month' | 'year';
    features: string[];
    limits: {
        dealsPerMonth: number;
    };
    stripePriceId: string;
    stripeYearlyPriceId?: string;
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
    free: {
        id: 'free',
        name: 'Free',
        price: 0,
        yearlyPrice: 0,
        interval: 'month',
        features: [
            'Analyze and create 8 contracts/month',
            'Support Line, Messenger, and other apps',
            'Draft basic legal agreements',
            'Download ready-to-use PDF'
        ],
        limits: {
            dealsPerMonth: 8,
        },
        stripePriceId: '',
    },
    lite: {
        id: 'lite',
        name: 'Lite',
        price: 159,
        yearlyPrice: 1590, // 159 * 10 months (2 months free)
        interval: 'month',
        features: [
            'Analyze and create 30 contracts/month',
            'No Lawslane watermark',
            'High-speed AI processing',
            'Unlimited history storage',
            'Long chat screenshot support'
        ],
        limits: {
            dealsPerMonth: 30,
        },
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_LITE || '',
        stripeYearlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_LITE_YEARLY || '',
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        price: 249,
        yearlyPrice: 2490, // 249 * 10 months (2 months free)
        interval: 'month',
        features: [
            'Analyze and create 100 contracts/month',
            'All features in Lite plan',
            'Full legal templates access',
            'Priority AI processing',
            'Support for multi-party agreements'
        ],
        limits: {
            dealsPerMonth: 100,
        },
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO || '',
        stripeYearlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_YEARLY || '',
    },
    scale: {
        id: 'scale',
        name: 'Scale',
        price: 1049,
        yearlyPrice: 10490, // 1049 * 10 months (2 months free)
        interval: 'month',
        features: [
            'Analyze and create 1,000 contracts/month',
            'All features in Pro plan',
            'Advanced AI analysis models',
            'Team collaboration tools',
            'Contract management system for teams'
        ],
        limits: {
            dealsPerMonth: 1000,
        },
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_SCALE || '',
        stripeYearlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_SCALE_YEARLY || '',
    },
};

export type PlanId = keyof typeof SUBSCRIPTION_PLANS;
