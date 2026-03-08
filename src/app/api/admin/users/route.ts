import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';

export async function GET() {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) {
            return NextResponse.json({ error: 'Failed to initialize admin' }, { status: 500 });
        }

        const db = adminApp.firestore();
        const usersSnap = await db.collection('users')
            .limit(100)
            .get();

        const users = usersSnap.docs.map(doc => {
            const data = doc.data();
            return {
                uid: doc.id,
                ...data,
                registeredAt: data.registeredAt?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            };
        });

        return NextResponse.json({ users });
    } catch (error: any) {
        console.error('ADMIN_USERS_ERROR', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
