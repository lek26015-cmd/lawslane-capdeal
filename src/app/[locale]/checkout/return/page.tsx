'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

function CheckoutReturnContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<string | null>(null);
    const [customerEmail, setCustomerEmail] = useState<string | null>(null);
    const sessionId = searchParams.get('session_id');

    useEffect(() => {
        if (sessionId) {
            fetch(`/api/checkout/status?session_id=${sessionId}`)
                .then((res) => res.json())
                .then((data) => {
                    setStatus(data.status);
                    setCustomerEmail(data.customer_email);
                })
                .catch((err) => {
                    console.error('Error fetching session status:', err);
                    setStatus('error');
                });
        }
    }, [sessionId]);

    if (!sessionId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <XCircle className="h-16 w-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Invalid Session</h1>
                <p className="text-muted-foreground mb-6">No session ID was provided.</p>
                <Link href="/pricing">
                    <Button>Back to Pricing</Button>
                </Link>
            </div>
        );
    }

    if (status === 'open') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
                <h1 className="text-2xl font-bold mb-2">Payment Incomplete</h1>
                <p className="text-muted-foreground mb-6">
                    Your payment is still being processed or was not completed.
                </p>
                <Link href="/pricing">
                    <Button variant="outline">Try Again</Button>
                </Link>
            </div>
        );
    }

    if (status === 'complete') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-4" />
                <h1 className="text-3xl font-bold mb-2">Subscription Successful!</h1>
                <p className="text-muted-foreground mb-6 max-w-md">
                    Thank you for subscribing to Lawslane CapDeal.
                    {customerEmail && ` A confirmation email will be sent to ${customerEmail}.`}
                </p>
                <div className="flex gap-4">
                    <Link href="/dashboard">
                        <Button>Go to Dashboard</Button>
                    </Link>
                    <Link href="/">
                        <Button variant="outline">Home</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-vh-100 p-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <p className="text-lg">Verifying your payment status...</p>
        </div>
    );
}

export default function CheckoutReturnPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <p className="text-lg">Loading payment status...</p>
            </div>
        }>
            <CheckoutReturnContent />
        </Suspense>
    );
}
