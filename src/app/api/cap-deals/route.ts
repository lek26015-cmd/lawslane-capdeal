import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';
import { requireUser, authErrorResponse } from '@/lib/auth-guard';

/**
 * Fetch cap deal contracts for a user using firebase-admin (bypasses security rules)
 */
export async function POST(req: Request) {
    // route นี้ใช้ Admin SDK ซึ่งข้าม Firestore rules (ตาม comment ด้านบน)
    // จึงต้องยึด uid จาก session ที่ตรวจแล้ว ไม่ใช่ค่าที่ client ส่งมา
    let userId: string;
    try {
        ({ uid: userId } = await requireUser());
    } catch (e) {
        return authErrorResponse(e);
    }

    try {

        const adminApp = await initAdmin();
        if (!adminApp) {
            return NextResponse.json({ capDeals: [] });
        }

        const adminDb = adminApp.firestore();

        // Try with orderBy first, fall back to without if index doesn't exist
        let contractSnap;
        try {
            contractSnap = await adminDb.collection('contracts')
                .where('ownerId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(5)
                .get();
        } catch {
            // Fallback: query without orderBy (no composite index needed)
            contractSnap = await adminDb.collection('contracts')
                .where('ownerId', '==', userId)
                .limit(10)
                .get();
        }

        const capDeals = contractSnap.docs.map((d: any) => {
            const data = d.data();
            const createdAt = data.createdAt?.toDate?.() || new Date();
            return {
                id: d.id,
                title: data.title || '',
                task: data.task || '',
                price: data.price || 0,
                status: data.status || 'draft',
                createdAt: createdAt.toISOString(),
            };
        });

        // Sort by date descending (in case fallback was used)
        capDeals.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({ capDeals: capDeals.slice(0, 5) });
    } catch (error: any) {
        console.error('CAP_DEALS_ERROR', error);
        return NextResponse.json({ capDeals: [] });
    }
}
