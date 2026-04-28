import { initializeFirebase } from '@/firebase';
import {
    doc,
    getDoc,
    onSnapshot,
    Timestamp
} from 'firebase/firestore';

export interface InvoiceItem {
    description: string;
    amount: number;
}

export interface InvoiceData {
    id: string;
    chatId: string;
    userId: string;
    lawyerId: string;
    title: string;
    amount: number;
    status: 'pending' | 'paid' | 'cancelled';
    type: 'proposal' | 'invoice';
    items: InvoiceItem[];
    clientInfo?: {
        name: string;
        address: string;
        taxId: string;
    };
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

const COLLECTION_NAME = 'invoices';

export const invoiceService = {
    // Get an invoice or contract by ID (or chatId as fallback)
    async getInvoice(id: string): Promise<InvoiceData | null> {
        const { firestore } = initializeFirebase();
        if (!firestore) throw new Error('Firestore not initialized');

        const collections = ['invoices', 'contracts'];
        
        // 1. Try fetching by Document ID in both collections
        for (const collName of collections) {
            const docRef = doc(firestore, collName, id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                return { 
                    id: docSnap.id, 
                    ...data,
                    // Normalize status and type for contracts if found there
                    status: data.status || 'pending',
                    type: collName === 'invoices' ? (data.type || 'invoice') : 'contract'
                } as InvoiceData;
            }
        }

        // 2. Fallback: Search by chatId or caseId in both collections
        const { query, where, collection, getDocs, limit } = await import('firebase/firestore');
        const searchFields = ['chatId', 'caseId', 'case_id', 'chat_id'];
        
        for (const collName of collections) {
            for (const field of searchFields) {
                const q = query(
                    collection(firestore, collName),
                    where(field, '==', id),
                    limit(1)
                );
                const querySnap = await getDocs(q);
                if (!querySnap.empty) {
                    const foundDoc = querySnap.docs[0];
                    const data = foundDoc.data();
                    return { 
                        id: foundDoc.id, 
                        ...data,
                        status: data.status || 'pending',
                        type: collName === 'invoices' ? (data.type || 'invoice') : 'contract'
                    } as InvoiceData;
                }
            }
        }

        return null;
    },

    // Real-time subscription
    subscribeToInvoice(id: string, callback: (data: InvoiceData) => void) {
        const { firestore } = initializeFirebase();
        if (!firestore) return () => { };

        const docRef = doc(firestore, COLLECTION_NAME, id);
        return onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                callback({ id: doc.id, ...doc.data() } as InvoiceData);
            }
        });
    }
};
