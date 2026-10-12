'use client';

import { useEffect, useState } from 'react';
import { defaultPublicAmounts, PAID_PLAN_IDS, PublicPlanAmounts } from '@/lib/plan-pricing-core';

/**
 * ราคาแพลนที่แสดงบนเว็บ — เริ่มจากราคาในโค้ด (subscription.ts) แล้วแทนด้วยค่าจาก /api/plan-pricing
 * (ราคากลาง planPricing/capdeal) · โหลดไม่ได้ = ใช้ราคาในโค้ดต่อ ไม่มีเอกสาร = เหมือนเดิมทุกอย่าง
 * โหลดครั้งเดียวต่อหน้า ใช้ร่วมกันทุกที่ที่เรียก hook นี้
 */
let pending: Promise<PublicPlanAmounts | null> | null = null;

function isAmount(v: unknown): v is number | null {
    return v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
}

function fetchAmounts(): Promise<PublicPlanAmounts | null> {
    if (!pending) {
        pending = fetch('/api/plan-pricing')
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                const plans = data?.plans;
                if (!plans || typeof plans !== 'object') return null;
                const out = defaultPublicAmounts();
                for (const id of PAID_PLAN_IDS) {
                    const p = plans[id];
                    if (p && isAmount(p.monthly) && isAmount(p.yearly)) out[id] = { monthly: p.monthly, yearly: p.yearly };
                }
                return out;
            })
            .catch(() => {
                pending = null; // ลองใหม่ได้ครั้งหน้า
                return null;
            });
    }
    return pending;
}

export function usePlanPricing(): PublicPlanAmounts {
    const [amounts, setAmounts] = useState<PublicPlanAmounts>(defaultPublicAmounts);

    useEffect(() => {
        let alive = true;
        fetchAmounts().then((a) => {
            if (alive && a) setAmounts(a);
        });
        return () => {
            alive = false;
        };
    }, []);

    return amounts;
}
