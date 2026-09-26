'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';
import { SUBSCRIPTION_PLANS, PlanId } from '@/lib/subscription';

type Usage = {
    planId: PlanId;
    isPaid: boolean;
    deals: number;
    dealsLimit: number;
    scans: number;
    scansLimit: number;
};

/**
 * แพ็กเกจ + โควตาเดือนนี้ — ตัวเลขมาจาก /api/usage ซึ่งเป็นค่าเดียวกับที่ server ใช้ตัดสิน
 * เดิมนับจำนวน contracts ในเบราว์เซอร์ (แพลนรายปีไม่โดนนับ, query พังแล้วถือว่า 0)
 * ค่าในนี้ใช้แสดงผล/UX เท่านั้น ด่านจริงอยู่ฝั่ง server
 */
export function useSubscription() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [usage, setUsage] = useState<Usage | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!user) {
            setProfile(null);
            setUsage(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [usageRes, userSnap] = await Promise.all([
                fetch('/api/usage', { cache: 'no-store' }),
                firestore ? getDoc(doc(firestore, 'users', user.uid)).catch(() => null) : Promise.resolve(null),
            ]);
            setUsage(usageRes.ok ? await usageRes.json() : null);
            setProfile(userSnap?.exists() ? (userSnap.data() as UserProfile) : null);
        } catch (error) {
            console.error('Error fetching subscription data:', error);
        } finally {
            setLoading(false);
        }
    }, [user, firestore]);

    useEffect(() => {
        if (!isUserLoading) refresh();
    }, [isUserLoading, refresh]);

    const planId: PlanId = usage?.planId ?? 'free';
    const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.free;
    const dealsLimit = usage?.dealsLimit ?? plan.limits.dealsPerMonth;
    const casesThisMonth = usage?.deals ?? 0;

    return {
        profile,
        plan,
        planId,
        casesThisMonth,
        dealsLimit,
        scansThisMonth: usage?.scans ?? 0,
        scansLimit: usage?.scansLimit ?? 0,
        isCapped: usage ? usage.deals >= usage.dealsLimit : false,
        isLoading: loading || isUserLoading,
        isActive: usage?.isPaid ?? false,
        refresh,
    };
}
