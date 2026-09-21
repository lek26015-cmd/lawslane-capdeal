'use server';

import { r2 } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { requireUser } from '@/lib/auth-guard';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

const ALLOWED_CONTENT_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
]);

// โฟลเดอร์ปลายทางต้องอยู่ในรายการนี้เท่านั้น — เดิม folder มาจากผู้เรียกแบบอิสระ
// จึงเขียน object ไปที่ prefix ไหนก็ได้ใน bucket
const ALLOWED_FOLDER_PATTERNS: RegExp[] = [
    /^uploads$/,
    /^payment-slips$/,
    /^profile-images$/,
    /^sme-requests$/,
    /^contracts\/[A-Za-z0-9_-]+\/attachments$/,
];

export async function uploadToR2(formData: FormData, folder: string = 'uploads') {
    // ต้องล็อกอินอยู่จริง — เดิมใครก็ยิง server action นี้อัปไฟล์ขึ้น R2 ของเราได้
    await requireUser();

    const file = formData.get('file') as File;
    if (!file) {
        throw new Error('No file provided');
    }

    if (!ALLOWED_FOLDER_PATTERNS.some((re) => re.test(folder))) {
        throw new Error('Invalid upload destination');
    }

    if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error('File is too large');
    }

    if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
        throw new Error('Unsupported file type');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${folder}/${timestamp}_${safeName}`;

    try {
        console.log(`[Server Action] Uploading to R2: ${key}`);

        await r2.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: file.type,
        }));

        // Construct Public URL
        const baseUrl = process.env.R2_PUBLIC_URL || '';
        const publicUrl = `${baseUrl}/${key}`;

        console.log(`[Server Action] Upload success: ${publicUrl}`);

        return publicUrl;

    } catch (error) {
        console.error("R2 Upload Error:", error);
        throw new Error('Failed to upload to R2');
    }
}
