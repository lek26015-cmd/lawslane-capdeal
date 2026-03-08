import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-06-20' as any,
    appInfo: {
        name: 'Lawslane CapDeal',
        version: '0.1.0',
    },
});
