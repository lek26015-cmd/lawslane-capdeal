'use server';

import { initAdmin } from '@/lib/firebase-admin';
import type { Case, UpcomingAppointment, ReportedTicket } from '@/lib/types';
import * as admin from 'firebase-admin';

export async function getUserDashboardData(userId: string) {
    const adminApp = await initAdmin();
    if (!adminApp) {
        throw new Error('Firebase Admin not initialized');
    }
    const db = adminApp.firestore();

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
    let allContracts: any[] = [];
    const seenIds = new Set<string>();

    try {
        // Search 'contracts' collection
        const c1 = await db.collection('contracts').where('ownerId', '==', userId).get();
        const c2 = await db.collection('contracts').where('userId', '==', userId).get();
        
        // Search 'cap-deals' collection
        const d1 = await db.collection('cap-deals').where('ownerId', '==', userId).get();
        const d2 = await db.collection('cap-deals').where('userId', '==', userId).get();

        const allDocs = [...c1.docs, ...c2.docs, ...d1.docs, ...d2.docs];
        
        allDocs.forEach(doc => {
            if (!seenIds.has(doc.id)) {
                seenIds.add(doc.id);
                const data = doc.data();
                
                // ONLY extract fields we actually use in the UI to ensure serialization
                allContracts.push({
                    id: doc.id,
                    title: data.title || 'สัญญาจ้างทำของ',
                    status: data.status || 'draft',
                    price: data.price || 0,
                    task: data.task || '',
                    createdAt: data.createdAt instanceof admin.firestore.Timestamp ? data.createdAt.toDate().toISOString() : 
                               (data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate().toISOString() : 
                               (data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString())),
                });
            }
        });
    } catch (e) {
        console.error("Server-side contract fetch failed:", e);
    }

    // Sort in memory to avoid requiring a composite index
    allContracts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const finalContracts = allContracts.slice(0, 5);

    // Fetch User Profile
    const userDoc = await db.collection('users').doc(userId).get();
    let profile = null;
    if (userDoc.exists) {
        const rawProfile = userDoc.data() || {};
        // ONLY extract fields we actually use in the UI
        profile = {
            name: rawProfile.name || '',
            avatar: rawProfile.avatar || '',
            email: rawProfile.email || '',
        };
    }

    // Return empty arrays for cases and appointments as they are lawyer-specific
    return {
        cases: [],
        appointments: [],
        tickets,
        contracts: finalContracts,
        profile
    };
}

