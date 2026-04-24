import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { initAdmin } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
    try {
        const headersList = await headers();
        const authHeader = headersList.get('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];

        const adminApp = await initAdmin();
        if (!adminApp) {
            return NextResponse.json({ error: 'Failed to initialize admin' }, { status: 500 });
        }

        // Verify the ID token
        let decodedToken;
        try {
            decodedToken = await adminApp.auth().verifyIdToken(token);
        } catch (error) {
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        // Check for admin role (email or UID)
        const isAdmin = decodedToken.email === 'lek.26015@gmail.com' || decodedToken.role === 'admin';
        if (!isAdmin) {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
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
