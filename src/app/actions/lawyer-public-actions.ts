'use server';

import { initAdmin } from '@/lib/firebase-admin';

/**
 * ข้อมูลทนายที่หน้าใบแจ้งหนี้ / ชำระเงิน / รีวิว ใช้แสดง — อ่านผ่าน Admin SDK แล้วคืนเฉพาะฟิลด์สาธารณะ
 *
 * เดิมหน้าเหล่านี้ getDoc('lawyerProfiles') จาก browser ได้เอกสารเต็มของทนาย (เบอร์ อีเมล ที่อยู่
 * เลขบัญชี เลขบัตรประชาชน path เอกสารสมัคร) และต้องให้ Firestore rules เปิด get สาธารณะ
 * ตอนนี้ rules ปิด get เหลือเจ้าของ/แอดมิน (repo Lawslane firestore.rules) — ห้ามกลับไปอ่านจาก client
 */
export type PublicLawyerCard = {
    id: string;
    name: string;
    imageUrl: string;
    licenseNumber: string;
    firmName: string;
};

export async function getPublicLawyerCardAction(lawyerId: string): Promise<PublicLawyerCard | null> {
    if (!lawyerId || typeof lawyerId !== 'string' || lawyerId.includes('/') || lawyerId.length > 128) return null;
    try {
        const app = await initAdmin();
        if (!app) return null;
        const snap = await app.firestore().collection('lawyerProfiles').doc(lawyerId).get();
        if (!snap.exists) return null;
        const d = snap.data() || {};
        return {
            id: snap.id,
            name: typeof d.name === 'string' ? d.name : '',
            imageUrl: typeof d.imageUrl === 'string' ? d.imageUrl : '',
            licenseNumber: typeof d.licenseNumber === 'string' ? d.licenseNumber : '',
            firmName: typeof d.firmName === 'string' ? d.firmName : '',
        };
    } catch (error) {
        console.error('Error fetching public lawyer card:', error);
        return null;
    }
}
