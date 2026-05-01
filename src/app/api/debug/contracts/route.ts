
import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    try {
        const adminApp = await initAdmin();
        const db = adminApp.firestore();

        const results: any = {
            contracts: [],
            capDeals: [],
            userFound: false
        };

        // Check user
        const userDoc = await db.collection('users').doc(userId).get();
        results.userFound = userDoc.exists;
        if (userDoc.exists) results.userData = userDoc.data();

        // Check contracts
        const c1 = await db.collection('contracts').where('ownerId', '==', userId).get();
        results.contracts = c1.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const c2 = await db.collection('contracts').where('userId', '==', userId).get();
        results.contractsUserId = c2.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Check cap-deals
        const d1 = await db.collection('cap-deals').where('ownerId', '==', userId).get();
        results.capDeals = d1.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return NextResponse.json(results);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
