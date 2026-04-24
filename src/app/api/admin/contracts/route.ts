import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';

export async function GET() {
    try {
        const { adminApp, error, status } = await verifyAdmin();
        if (error) return NextResponse.json({ error }, { status });

        const db = adminApp!.firestore();
        const contractsSnap = await db.collection('contracts')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();

        const contracts = contractsSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            };
        });

        return NextResponse.json({ contracts });
    } catch (error: any) {
        console.error('ADMIN_CONTRACTS_ERROR', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
