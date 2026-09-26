import { NextResponse } from 'next/server';
import { requireUser, authErrorResponse } from '@/lib/auth-guard';
import { getUsageSummary } from '@/lib/entitlement';

/** แพ็กเกจและโควตาเดือนนี้ของผู้ใช้ — ตัวเลขเดียวกับที่ server ใช้ตัดสิน */
export async function GET() {
    let session;
    try {
        session = await requireUser();
    } catch (e) {
        return authErrorResponse(e);
    }
    const usage = await getUsageSummary(session.adminApp.firestore(), session.uid);
    return NextResponse.json(usage, { headers: { 'Cache-Control': 'private, no-store' } });
}
