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

    // Fetch Contracts from multiple possible collections and fields
    const collectionsToSearch = ['contracts', 'cap-deals'];
    const fieldsToSearch = ['ownerId', 'userId'];
    
    let allContractDocs: any[] = [];
    const seenContractIds = new Set<string>();

    for (const colName of collectionsToSearch) {
        const colRef = db.collection(colName);
        for (const fieldName of fieldsToSearch) {
            try {
                const snap = await colRef.where(fieldName, '==', userId).get();
                snap.docs.forEach(doc => {
                    if (!seenContractIds.has(doc.id)) {
                        seenContractIds.add(doc.id);
                        allContractDocs.push(doc);
                    }
                });
            } catch (e) {
                console.warn(`Server search failed for ${colName}.${fieldName}:`, e);
            }
        }
    }

    const contracts = allContractDocs.map(d => {
        const data = d.data();
        // Convert all possible timestamps to strings
        return {
            id: d.id,
            ...data,
            createdAt: data.createdAt instanceof admin.firestore.Timestamp ? data.createdAt.toDate().toISOString() : 
                       (data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString()),
            updatedAt: data.updatedAt instanceof admin.firestore.Timestamp ? data.updatedAt.toDate().toISOString() : 
                       (data.updatedAt ? (typeof data.updatedAt === 'string' ? data.updatedAt : new Date(data.updatedAt).toISOString()) : new Date().toISOString()),
        };
    });

    // Sort in memory to avoid requiring a composite index
    contracts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const finalContracts = contracts.slice(0, 5);

    // Fetch User Profile
    const userDoc = await db.collection('users').doc(userId).get();
    const profile = userDoc.exists ? userDoc.data() : null;

    // Return empty arrays for cases and appointments as they are lawyer-specific
    return {
        cases: [] as Case[],
        appointments: [] as UpcomingAppointment[],
        tickets,
        contracts: finalContracts,
        profile
    };
}

