'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';
import { SUBSCRIPTION_PLANS, PlanId } from '@/lib/subscription';

export function useSubscription() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [casesThisMonth, setCasesThisMonth] = useState(0);

    useEffect(() => {
        async function fetchSubscriptionData() {
            if (!user || !firestore) {
                setProfile(null);
                setCasesThisMonth(0);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                // 1. Fetch User Profile
                const userDocRef = doc(firestore, 'users', user.uid);
                let userDocSnap;
                try {
                    userDocSnap = await getDoc(userDocRef);
                } catch (e: any) {
                    console.warn("Permission denied reaching user doc in useSubscription:", e.message);
                }

                let currentProfile = null;
                if (userDocSnap && userDocSnap.exists()) {
                    currentProfile = userDocSnap.data() as UserProfile;
                    setProfile(currentProfile);
                }

                // 2. Determine Plan
                const planId = currentProfile?.subscription?.status === 'active'
                    ? (currentProfile.subscription.planId as PlanId)
                    : 'free';

                const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.free;

                // 3. Calculate current period start based on plan type
                let periodStart = new Date();
                periodStart.setDate(1);
                periodStart.setHours(0, 0, 0, 0); // Default to start of current calendar month

                if (currentProfile?.subscription?.status === 'active' && currentProfile.subscription.currentPeriodEnd) {
                    const endTimestamp = currentProfile.subscription.currentPeriodEnd as Timestamp;
                    if (endTimestamp && typeof endTimestamp.toDate === 'function') {
                        const endDate = endTimestamp.toDate();
                        // Subtract approx 1 month to get start of current billing period
                        periodStart = new Date(endDate);
                        periodStart.setMonth(periodStart.getMonth() - 1);
                    }
                }

                // 4. Fetch Cases Created in Current Period
                const chatsRef = collection(firestore, 'chats');

                try {
                    // Query cases where this user is the creator (clientId field)
                    const q = query(
                        chatsRef,
                        where('clientId', '==', user.uid)
                    );

                    const querySnapshot = await getDocs(q);

                    // Filter by date locally
                    const recentCases = querySnapshot.docs.filter(docSnap => {
                        const chatData = docSnap.data();
                        if (!chatData.createdAt) return false;
                        const createdAt = chatData.createdAt?.toDate ? chatData.createdAt.toDate() : new Date(chatData.createdAt);
                        return createdAt >= periodStart;
                    });

                    setCasesThisMonth(recentCases.length);
                } catch (e: any) {
                    console.warn("Permission denied or error fetching chats in useSubscription:", e.message);
                    setCasesThisMonth(0);
                }

            } catch (error) {
                console.error("Error fetching subscription data:", error);
            } finally {
                setLoading(false);
            }
        }

        if (!isUserLoading) {
            fetchSubscriptionData();
        }
    }, [user, firestore, isUserLoading]);

    const planId = profile?.subscription?.status === 'active'
        ? (profile.subscription.planId as PlanId)
        : 'free';

    const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.free;
    const isCapped = casesThisMonth >= plan.limits.dealsPerMonth;

    return {
        profile,
        plan,
        planId,
        casesThisMonth,
        dealsLimit: plan.limits.dealsPerMonth,
        isCapped,
        isLoading: loading || isUserLoading,
        isActive: profile?.subscription?.status === 'active'
    };
}
