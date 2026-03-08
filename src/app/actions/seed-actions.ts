'use server';

import { initAdmin } from '@/lib/firebase-admin';

export async function deleteTestData() {
    const adminApp = await initAdmin();
    if (!adminApp) {
        return { success: false, error: 'Firebase Admin not initialized' };
    }
    const db = adminApp.firestore();

    try {
        let deletedChats = 0;
        let deletedLawyers = 0;

        // Delete mock chats
        const chatsRef = db.collection('chats');
        const chatsSnapshot = await chatsRef.get();

        for (const chatDoc of chatsSnapshot.docs) {
            const data = chatDoc.data();
            if (data.caseTitle?.includes('[ทดสอบ]') || data.lawyerId === 'mock-lawyer-001') {
                // Delete messages subcollection
                const messagesRef = db.collection('chats').doc(chatDoc.id).collection('messages');
                const messagesSnapshot = await messagesRef.get();

                const batch = db.batch();
                messagesSnapshot.docs.forEach((msgDoc) => {
                    batch.delete(msgDoc.ref);
                });
                await batch.commit();

                // Delete chat document
                await chatDoc.ref.delete();
                deletedChats++;
            }
        }

        // Delete mock lawyer profiles
        const lawyersRef = db.collection('lawyerProfiles');
        const lawyersSnapshot = await lawyersRef.get();

        for (const lawyerDoc of lawyersSnapshot.docs) {
            const data = lawyerDoc.data();
            const name = data.name || '';
            if (
                lawyerDoc.id === 'mock-lawyer-001' ||
                name.includes('[ทดสอบ]') ||
                name.includes('จำลอง') ||
                name.includes('ทดสอบ')
            ) {
                await lawyerDoc.ref.delete();
                deletedLawyers++;
            }
        }

        return {
            success: true,
            deletedChats,
            deletedLawyers
        };
    } catch (error: any) {
        console.error('Error deleting test data:', error);
        return { success: false, error: error.message };
    }
}

export async function deleteLawyerById(lawyerId: string) {
    const adminApp = await initAdmin();
    if (!adminApp) {
        return { success: false, error: 'Firebase Admin not initialized' };
    }
    const db = adminApp.firestore();

    try {
        const lawyerRef = db.collection('lawyerProfiles').doc(lawyerId);
        const lawyerDoc = await lawyerRef.get();

        if (!lawyerDoc.exists) {
            return { success: false, error: 'ไม่พบข้อมูลทนายความ' };
        }

        await lawyerRef.delete();

        return { success: true };
    } catch (error: any) {
        console.error('Error deleting lawyer:', error);
        return { success: false, error: error.message };
    }
}
