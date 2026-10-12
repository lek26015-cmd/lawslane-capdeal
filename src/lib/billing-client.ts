'use client';

import type { User } from 'firebase/auth';

/**
 * ตัวช่วยฝั่ง browser สำหรับ API เรื่องแพ็กเกจ
 * ส่ง Firebase ID token เป็น Bearer ด้วย — ไม่ต้องพึ่ง session cookie อย่างเดียว
 * (requireUser() ฝั่ง server รับได้ทั้งสองแบบ)
 */
export async function authHeaders(user: User | null | undefined): Promise<Record<string, string>> {
    if (!user) return {};
    try {
        return { Authorization: `Bearer ${await user.getIdToken()}` };
    } catch {
        return {};
    }
}

/** เปิด Stripe Billing Portal ของผู้ใช้ (เปลี่ยน/ยกเลิกแพ็กเกจ, แก้บัตร) */
export async function openBillingPortal(user: User | null | undefined): Promise<void> {
    const response = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(user)) },
        body: JSON.stringify({}),
    });
    const contentType = response.headers.get('content-type');
    if (!response.ok || !contentType?.includes('application/json')) {
        throw new Error(`portal ${response.status}`);
    }
    const { url } = await response.json();
    if (typeof url !== 'string') throw new Error('portal: no url');
    window.location.assign(url);
}
