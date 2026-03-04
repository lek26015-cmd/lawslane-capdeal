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
        price: 157.50,
        yearlyPrice: 1512.00, // (157.50 * 12) * 0.8
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
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        price: 249.17,
        yearlyPrice: 2392.00, // (249.17 * 12) * 0.8
        interval: 'month',
        features: [
            'Analyze and create 100 contracts/month',
            'All features in Lite plan',
            '1 lawyer consultation/month',
            'Legal accuracy verification',
            'Multi-party agreement support'
        ],
        limits: {
            dealsPerMonth: 100,
        },
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO || '',
    },
    scale: {
        id: 'scale',
        name: 'Scale',
        price: 1049.17,
        yearlyPrice: 10072.00, // (1049.17 * 12) * 0.8
        interval: 'month',
        features: [
            'Analyze and create 1,000 contracts/month',
            'All features in Pro plan',
            'Unlimited lawyer verification',
            'Custom contract drafting',
            'Team management system'
        ],
        limits: {
            dealsPerMonth: 1000,
        },
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_SCALE || '',
    },
};

export type PlanId = keyof typeof SUBSCRIPTION_PLANS;
