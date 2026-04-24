'use server';

import { initAdmin } from '@/lib/firebase-admin';
import type { Case, UpcomingAppointment, ReportedTicket } from '@/lib/types';
import * as admin from 'firebase-admin';

export async function getUserDashboardData(userId: string) {
    const adminApp = await initAdmin();
    if (!adminApp) {
        throw new Error('Firebase Admin not initialized');
    }
    const db = admin.firestore();

    // Fetch Tickets (Keep for support purposes)
    const ticketsRef = db.collection('tickets');
    const ticketSnap = await ticketsRef.where('userId', '==', userId).get();

    const tickets: ReportedTicket[] = ticketSnap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            caseId: data.caseId || '',
            lawyerId: data.lawyerId || '',
            caseTitle: data.caseTitle || '',
            problemType: data.problemType || '',
            status: data.status || 'pending',
            reportedAt: data.reportedAt instanceof admin.firestore.Timestamp ? data.reportedAt.toDate().toISOString() : new Date().toISOString(),
        } as any; // Cast to any to handle Date vs String in type
    });

    // Fetch Contracts (Cap and Deal)
    const contractsRef = db.collection('contracts');
    const contractSnap = await contractsRef.where('ownerId', '==', userId).orderBy('createdAt', 'desc').limit(5).get();

    const contracts = contractSnap.docs.map(d => {
        const data = d.data();
        // Convert all possible timestamps to strings
        return {
            id: d.id,
            ...data,
            createdAt: data.createdAt instanceof admin.firestore.Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
            updatedAt: data.updatedAt instanceof admin.firestore.Timestamp ? data.updatedAt.toDate().toISOString() : 
                       (data.updatedAt ? data.updatedAt : new Date().toISOString()),
        };
    });

    // Fetch User Profile
    const userDoc = await db.collection('users').doc(userId).get();
    const profile = userDoc.exists ? userDoc.data() : null;

    // Return empty arrays for cases and appointments as they are lawyer-specific
    return {
        cases: [] as Case[],
        appointments: [] as UpcomingAppointment[],
        tickets,
        contracts,
        profile
    };
}

