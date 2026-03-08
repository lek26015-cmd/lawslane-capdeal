import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';

export async function GET() {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) {
            return NextResponse.json({ error: 'Failed to initialize admin' }, { status: 500 });
        }

        const db = adminApp.firestore();
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
