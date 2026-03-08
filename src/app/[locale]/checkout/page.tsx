'use client';

import React, { useCallback, useEffect, useState, Suspense } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    EmbeddedCheckoutProvider,
    EmbeddedCheckout
} from '@stripe/react-stripe-js';
import { useSearchParams } from 'next/navigation';
import { useFirebase } from '@/firebase/provider';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2, XCircle } from 'lucide-react';

function CheckoutContent() {
    const searchParams = useSearchParams();
    const { user } = useFirebase();
    const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isKeyConfigured, setIsKeyConfigured] = useState<boolean | null>(null);

    useEffect(() => {
        const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!key) {
            console.error('Stripe publishable key is missing from environment variables');
            setIsKeyConfigured(false);
            return;
        }

        console.log('Initializing Stripe with key starting with:', key.substring(0, 8));
        setIsKeyConfigured(true);

        loadStripe(key)
            .then((res) => {
                if (res) {
                    setStripePromise(Promise.resolve(res));
                } else {
                    setError('Failed to load Stripe payment interface. Please disable any ad-blockers and try again.');
                }
            })
            .catch((err) => {
                console.error("Stripe load error:", err);
                setError('Failed to load Stripe.js. Please check your network connection or disable ad-blockers.');
            });
    }, []);

    const planId = searchParams.get('planId');
    const billingInterval = searchParams.get('interval') || 'month';

    const fetchClientSecret = useCallback(async () => {
        if (!user || !planId) return;

        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    planId,
                    userId: user.uid,
                    customerEmail: user.email,
                    billingInterval,
                }),
            });

            const data = await response.json();
            if (data.clientSecret) {
                setClientSecret(data.clientSecret);
            } else {
                setError(data.error || 'Failed to initialize checkout');
            }
        } catch (err: any) {
            console.error('Error fetching client secret:', err);
            setError('An error occurred. Please try again.');
        }
    }, [user, planId, billingInterval]);

    useEffect(() => {
        if (user && planId) {
            fetchClientSecret();
        }
    }, [user, planId, fetchClientSecret]);

    if (!planId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
                <h1 className="text-2xl font-bold mb-4">No plan selected</h1>
                <Link href="/pricing">
                    <Button variant="outline">
                        <ChevronLeft className="mr-2 h-4 w-4" /> Back to Pricing
                    </Button>
                </Link>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
                <XCircle className="h-12 w-12 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-red-500 mb-2">Error</h1>
                <p className="mb-6 text-muted-foreground">{error}</p>
                <Link href="/pricing">
                    <Button variant="outline">Back to Pricing</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-12 px-4 max-w-4xl">
            <div className="mb-8">
                <Link href="/pricing" className="text-sm text-muted-foreground hover:text-primary flex items-center mb-4">
                    <ChevronLeft className="h-4 w-4 mr-1" /> Back to pricing
                </Link>
                <h1 className="text-3xl font-bold">Complete your subscription</h1>
                <p className="text-muted-foreground mt-2">
                    Secure payment for your Lawslane CapDeal plan
                </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-1 min-h-[600px] flex items-center justify-center">
                {isKeyConfigured === false ? (
                    <div className="text-center p-8 text-red-500">
                        <h2 className="text-xl font-semibold mb-2">Stripe Configuration Error</h2>
                        <p>Stripe Publishable Key is missing from environment variables.</p>
                    </div>
                ) : (stripePromise && clientSecret) ? (
                    <div id="checkout" className="w-full">
                        <EmbeddedCheckoutProvider
                            stripe={stripePromise}
                            options={{ clientSecret }}
                        >
                            <EmbeddedCheckout />
                        </EmbeddedCheckoutProvider>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-10 w-10 text-primary animate-spin" />
                        <p className="text-muted-foreground">Preparing checkout...</p>
                    </div>
                )}
            </div>

            <div className="mt-8 text-center text-sm text-muted-foreground">
                <p>Your payment information is processed securely by Stripe.</p>
                <p className="mt-1">By continuing, you agree to our terms of service.</p>
            </div>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>Loading checkout...</p>
            </div>
        }>
            <CheckoutContent />
        </Suspense>
    );
}
