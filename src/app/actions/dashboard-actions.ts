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
            reportedAt: data.reportedAt instanceof admin.firestore.Timestamp ? data.reportedAt.toDate() : new Date(),
        };
    });

    // Return empty arrays for cases and appointments as they are lawyer-specific
    return {
        cases: [] as Case[],
        appointments: [] as UpcomingAppointment[],
        tickets
    };
}
