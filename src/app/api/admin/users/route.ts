import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
    try {
        const { adminApp, error, status } = await verifyAdmin();
        if (error) return NextResponse.json({ error }, { status });

        const db = adminApp!.firestore();
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

export async function PATCH(req: NextRequest) {
    try {
        const { adminApp, error, status } = await verifyAdmin();
        if (error) return NextResponse.json({ error }, { status });

        const { uid, role } = await req.json();
        if (!uid || !role) {
            return NextResponse.json({ error: 'Missing uid or role' }, { status: 400 });
        }

        const db = adminApp!.firestore();
        await db.collection('users').doc(uid).update({
            role,
            updatedAt: new Date()
        });

        // Also update custom claims for role
        await adminApp!.auth().setCustomUserClaims(uid, { role });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('ADMIN_USERS_PATCH_ERROR', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { adminApp, error, status } = await verifyAdmin();
        if (error) return NextResponse.json({ error }, { status });

        const { searchParams } = new URL(req.url);
        const uid = searchParams.get('uid');

        if (!uid) {
            return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
        }

        const db = adminApp!.firestore();
        
        // Delete from Firestore
        await db.collection('users').doc(uid).delete();
        
        // Delete from Auth
        await adminApp!.auth().deleteUser(uid);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('ADMIN_USERS_DELETE_ERROR', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
