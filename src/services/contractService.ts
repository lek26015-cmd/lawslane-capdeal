import { initializeFirebase } from '@/firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    query,
    where,
    getDocs
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export interface ContractParty {
    name: string;
    email?: string;
    id_card?: string;
    address?: string;
    signature?: string; // Base64 or URL
    signedAt?: Timestamp;
    verifiedPhoneNumber?: string;
    otpVerificationTimestamp?: Timestamp;
    authUid?: string;
}

export interface ContractData {
    id: string;
    title: string;
    content?: string; // HTML or text description

    // B2B & CLM Fields
    companyId?: string; // For B2B isolation
    ownerId: string;    // Creator of the contract
    category?: 'employment' | 'sales' | 'loan' | 'service' | 'nda' | 'other';
    notes?: string;
    attachments?: {
        name: string;
        url: string;
        type: string;
    }[];

    // Structured Data from the Screenshot Parser
    employer: ContractParty;
    contractor: ContractParty;

    task: string;
    price: number;
    deposit?: number;
    deadline: string;
    paymentTerms?: string;

    status: 'draft' | 'pending' | 'signed' | 'completed' | 'canceled';
    createdAt: Timestamp;
    updatedAt: Timestamp;

    // Sharing & Security — token / PIN hash เขียนโดย server เท่านั้น
    isPinProtected?: boolean;
    shareToken?: string;
    /** @deprecated PIN แบบ plaintext ของเดิม — server ลบทิ้งเมื่อสร้างลิงก์ใหม่ */
    sharePin?: string;
    signedTermsHash?: string;
}

/**
 * สัญญาจ้างทนายที่เว็บหลักสร้าง (lib/contract-service.ts) ไม่มี employer/contractor
 * แต่โผล่ใน dashboard นี้เพราะ query ด้วย userId — เติมค่าว่างกันหน้า crash
 */
export function normalizeContract(raw: any): ContractData {
    return {
        ...raw,
        employer: raw?.employer ?? { name: raw?.clientName ?? '' },
        contractor: raw?.contractor ?? { name: raw?.lawyerName ?? '' },
        task: raw?.task ?? '',
        price: Number(raw?.price ?? 0),
        deadline: raw?.deadline ?? '',
    } as ContractData;
}

const COLLECTION_NAME = 'contracts';

// Helper to recursively remove undefined values (Firestore doesn't accept undefined)
function cleanObject(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(cleanObject);

    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (value !== undefined) {
            cleaned[key] = typeof value === 'object' && value !== null && !value._methodName
                ? cleanObject(value)
                : value;
        }
    }
    return cleaned;
}

export const contractService = {
    // Create a new contract
    async createContract(data: Omit<ContractData, 'id' | 'createdAt' | 'updatedAt'>) {
        const { firestore } = initializeFirebase();
        if (!firestore) throw new Error('Firestore not initialized');

        const id = uuidv4();
        const now = serverTimestamp();

        const contract = cleanObject({
            ...data,
            id,
            createdAt: now,
            updatedAt: now,
        });

        await setDoc(doc(firestore, COLLECTION_NAME, id), contract);
        return id;
    },

    // Get a contract by ID
    async getContract(id: string): Promise<ContractData | null> {
        const { firestore } = initializeFirebase();
        if (!firestore) throw new Error('Firestore not initialized');

        const docRef = doc(firestore, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return normalizeContract(docSnap.data());
        } else {
            return null;
        }
    },

    // Sign a contract — ทำฝั่ง server เท่านั้น (ดู api/contracts/[id]/sign)
    // share = { token, pin } เมื่อเซ็นผ่านลิงก์แชร์โดยไม่ได้เป็นเจ้าของ
    async signContract(
        id: string,
        role: 'employer' | 'contractor',
        signature: string,
        phoneIdToken: string,
        share?: { token: string; pin?: string },
    ) {
        const res = await fetch(`/api/contracts/${encodeURIComponent(id)}/sign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, signature, phoneIdToken, ...share }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(body?.error || 'บันทึกลายเซ็นไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        }
        return body as { ok: true; status: 'pending' | 'signed' };
    },

    // Real-time subscription
    subscribeToContract(
        id: string,
        callback: (data: ContractData | null) => void,
        onError?: (error: Error) => void,
    ) {
        const { firestore } = initializeFirebase();
        if (!firestore) return () => { };

        const docRef = doc(firestore, COLLECTION_NAME, id);
        return onSnapshot(
            docRef,
            (snap) => callback(snap.exists() ? normalizeContract(snap.data()) : null),
            // ไม่มีสิทธิ์อ่าน (ไม่ใช่เจ้าของ / ยังไม่ล็อกอิน) — เดิมไม่มี error callback หน้าเลยหมุนโหลดไม่จบ
            (error) => onError?.(error),
        );
    },

    // Update contract status
    async updateContractStatus(id: string, status: ContractData['status']) {
        const { firestore } = initializeFirebase();
        if (!firestore) throw new Error('Firestore not initialized');

        const docRef = doc(firestore, COLLECTION_NAME, id);
        const now = serverTimestamp();

        await updateDoc(docRef, {
            status,
            updatedAt: now
        });
    },

    // Update contract details (only allowed if not signed)
    async updateContract(id: string, updates: Partial<Omit<ContractData, 'id' | 'createdAt' | 'updatedAt'>>) {
        const { firestore } = initializeFirebase();
        if (!firestore) throw new Error('Firestore not initialized');

        const docRef = doc(firestore, COLLECTION_NAME, id);
        const now = serverTimestamp();

        const cleanedUpdates = cleanObject({
            ...updates,
            updatedAt: now
        });

        await updateDoc(docRef, cleanedUpdates);
    },

    // Add list method for CLM
    async getContractsByCompany(companyId: string): Promise<ContractData[]> {
        const { firestore } = initializeFirebase();
        if (!firestore) throw new Error('Firestore not initialized');

        const q = query(
            collection(firestore, COLLECTION_NAME),
            where('companyId', '==', companyId)
        );

        const querySnapshot = await getDocs(q);
        const results = querySnapshot.docs.map(doc => doc.data() as ContractData);

        // Sort client-side to avoid requiring a composite index from the user
        return results.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
            return timeB - timeA;
        });
    },

    // Get contracts by user ID (client-side)
    async getContractsByUser(userId: string): Promise<ContractData[]> {
        const { firestore } = initializeFirebase();
        if (!firestore) throw new Error('Firestore not initialized');

        const { query, collection, where, getDocs } = await import('firebase/firestore');
        
        // We will check multiple collections and field names just in case of inconsistencies
        const collectionsToCheck = ['contracts', 'cap-deals'];
        const fieldsToCheck = ['ownerId', 'userId'];
        
        let allResults: ContractData[] = [];
        const seenIds = new Set<string>();

        for (const colName of collectionsToCheck) {
            for (const fieldName of fieldsToCheck) {
                try {
                    const q = query(
                        collection(firestore, colName),
                        where(fieldName, '==', userId)
                    );
                    const querySnapshot = await getDocs(q);
                    querySnapshot.docs.forEach(doc => {
                        if (!seenIds.has(doc.id)) {
                            seenIds.add(doc.id);
                            allResults.push({
                                ...doc.data(),
                                id: doc.id
                            } as ContractData);
                        }
                    });
                } catch (e) {
                    console.warn(`Query failed for ${colName}.${fieldName}:`, e);
                }
            }
        }

        // Sort client-side to avoid requiring a composite index
        return allResults.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
            return timeB - timeA;
        });
    },

    // สร้าง/รีเซ็ตลิงก์แชร์ — token และ PIN hash สร้างฝั่ง server (ดู api/contracts/[id]/share)
    // ทุกครั้งที่เรียกจะได้ลิงก์ใหม่ ลิงก์เก่าใช้ไม่ได้
    async generateShareLink(id: string, isPinProtected: boolean, sharePin?: string) {
        const res = await fetch(`/api/contracts/${encodeURIComponent(id)}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isPinProtected, pin: sharePin }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.path) {
            throw new Error(body?.error || 'ไม่สามารถสร้างลิงก์แชร์ได้');
        }
        const locale = window.location.pathname.split('/')[1] || 'th';
        return `${window.location.origin}/${locale}${body.path}`;
    }
};
