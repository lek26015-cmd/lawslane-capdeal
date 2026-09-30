import type { PlanTone } from '@/components/plan-avatar';

/** สีวงรอบรูปโปรไฟล์ตามแพลน: free → ไม่มีวง, lite → plus, pro → gold, scale → premium */
const PLAN_TONE: Record<string, PlanTone> = { free: 'none', lite: 'plus', pro: 'gold', scale: 'premium' };

export function planTone(planId: string | null | undefined): PlanTone {
    return (planId && PLAN_TONE[planId]) || 'none';
}
