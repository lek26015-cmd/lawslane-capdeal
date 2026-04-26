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
    // Get an invoice by ID
    async getInvoice(id: string): Promise<InvoiceData | null> {
        const { firestore } = initializeFirebase();
        if (!firestore) throw new Error('Firestore not initialized');

        const docRef = doc(firestore, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as InvoiceData;
        } else {
            return null;
        }
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
