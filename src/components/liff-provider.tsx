'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { Liff } from '@line/liff';

interface LiffContextType {
    liff: Liff | null;
    isInLineApp: boolean;
    isLiffReady: boolean;
    liffError: string | null;
    lineProfile: LineProfileData | null;
    loginWithLine: () => void;
}

interface LineProfileData {
    userId: string;
    displayName: string;
    pictureUrl?: string;
    statusMessage?: string;
}

const LiffContext = createContext<LiffContextType>({
    liff: null,
    isInLineApp: false,
    isLiffReady: false,
    liffError: null,
    lineProfile: null,
    loginWithLine: () => { },
});

export const useLiff = () => useContext(LiffContext);

interface LiffProviderProps {
    children: ReactNode;
}

export function LiffProvider({ children }: LiffProviderProps) {
    const [liff, setLiff] = useState<Liff | null>(null);
    const [isInLineApp, setIsInLineApp] = useState(false);
    const [isLiffReady, setIsLiffReady] = useState(false);
    const [liffError, setLiffError] = useState<string | null>(null);
    const [lineProfile, setLineProfile] = useState<LineProfileData | null>(null);

    useEffect(() => {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '2009102199-91OKr2aI';
        if (!liffId) {
            // LIFF not configured, skip initialization
            setIsLiffReady(true);
            return;
        }

        const initLiff = async () => {
            try {
                const liffModule = await import('@line/liff');
                const liffInstance = liffModule.default;

                await liffInstance.init({ liffId });

                setLiff(liffInstance);
                setIsInLineApp(liffInstance.isInClient());
                setIsLiffReady(true);

                // If user is logged in via LIFF, get profile and auto-auth with Firebase
                if (liffInstance.isLoggedIn()) {
                    try {
                        const profile = await liffInstance.getProfile();
                        setLineProfile({
                            userId: profile.userId,
                            displayName: profile.displayName,
                            pictureUrl: profile.pictureUrl,
                            statusMessage: profile.statusMessage,
                        });

                        // Auto sign-in to Firebase if in LINE app
                        if (liffInstance.isInClient()) {
                            await autoSignInFirebase(liffInstance);
                        }
                    } catch (profileErr) {
                        console.warn('[LIFF] Failed to get profile:', profileErr);
                    }
                }
            } catch (err: any) {
                console.error('[LIFF] Init failed:', err);
                setLiffError(err.message || 'LIFF initialization failed');
                setIsLiffReady(true); // Still set ready so app doesn't hang
            }
        };

        initLiff();
    }, []);

    const autoSignInFirebase = async (liffInstance: Liff) => {
        try {
            const accessToken = liffInstance.getAccessToken();
            const idToken = liffInstance.getIDToken();

            if (!accessToken) return;

            // Call our API to exchange LINE token for Firebase Custom Token
            const res = await fetch('/api/auth/line', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken, idToken }),
            });

            if (!res.ok) {
                console.error('[LIFF] Firebase auth failed:', await res.text());
                return;
            }

            const { customToken } = await res.json();

            // Sign in with Firebase Custom Token
            const { initializeFirebase } = await import('@/firebase');
            const { auth } = initializeFirebase();
            if (auth) {
                const { signInWithCustomToken } = await import('firebase/auth');
                await signInWithCustomToken(auth, customToken);
                console.log('[LIFF] Firebase sign-in successful');
            }
        } catch (err) {
            console.error('[LIFF] Auto sign-in error:', err);
        }
    };

    const loginWithLine = useCallback(() => {
        if (liff && !liff.isLoggedIn()) {
            liff.login({
                redirectUri: window.location.href,
            });
        } else if (liff && liff.isLoggedIn()) {
            // Already logged in, trigger Firebase auth
            autoSignInFirebase(liff);
        }
    }, [liff]);

    return (
        <LiffContext.Provider value={{
            liff,
            isInLineApp,
            isLiffReady,
            liffError,
            lineProfile,
            loginWithLine,
        }}>
            {children}
        </LiffContext.Provider>
    );
}
