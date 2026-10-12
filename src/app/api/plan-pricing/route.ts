import { NextResponse } from 'next/server';
import { getCapdealPricing, publicAmounts } from '@/lib/plan-pricing';

/**
 * ราคาแพลน CapDeal สำหรับแสดงผล (หน้า /pricing และหน้าแรก) — PLAN-08 เฟส 2
 * คืนแค่ตัวเลขบาทต่อ planId ไม่มี Price ID / portal config · ไม่ต้องล็อกอิน
 * ยอดที่เก็บเงินจริงหาจาก Price ID ฝั่ง server ตอนสร้าง Checkout เท่านั้น
 */
export const dynamic = 'force-dynamic';

export async function GET() {
    const pricing = await getCapdealPricing();
    return NextResponse.json(
        { currency: pricing.currency, plans: publicAmounts(pricing) },
        { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } },
    );
}
