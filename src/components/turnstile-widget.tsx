'use client';

import { useEffect, useState } from 'react';
import Turnstile from 'react-turnstile';

interface TurnstileWidgetProps {
    onVerify: (token: string) => void;
}

export function TurnstileWidget({ onVerify }: TurnstileWidgetProps) {
    const [siteKey, setSiteKey] = useState<string>('');

    useEffect(() => {
        const key = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;
        if (key) {
            setSiteKey(key);
        } else {
            console.warn('NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY is not set');
        }
    }, []);

    if (!siteKey) {
        // Development bypass
        if (process.env.NODE_ENV === 'development') {
            useEffect(() => {
                onVerify('dev-bypass-token');
            }, [onVerify]);

            return (
                <div className="flex justify-center my-4 p-4 bg-yellow-100 text-yellow-800 rounded-md border border-yellow-200">
                    <p className="text-sm font-medium">Development Mode: Turnstile Bypassed</p>
                </div>
            );
        }
        return null;
    }

    return (
        <div className="flex justify-center my-4">
            <Turnstile
                sitekey={siteKey}
                onVerify={onVerify}
                theme="light"
            />
        </div>
    );
}
