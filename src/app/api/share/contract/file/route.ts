import { NextRequest, NextResponse } from 'next/server';
import { contractService } from '@/services/contractService';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 Client for Cloudflare R2
const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});

// route นี้ไม่มี dynamic segment [id] — เดิมประกาศ params ผิด ทำให้ type ไม่ผ่าน
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const fileUrl = searchParams.get('fileUrl');
    const pin = searchParams.get('pin');

    if (!contractId || !fileUrl) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    try {
        // 1. Fetch contract data to check security settings
        const contractData = await contractService.getContract(contractId);
        
        if (!contractData) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        // 2. Security Check — เทียบ PIN แบบ constant-time
        if (contractData.isPinProtected) {
            const expected = contractData.sharePin ?? '';
            const a = Buffer.from(pin ?? '');
            const b = Buffer.from(expected);
            const { timingSafeEqual } = await import('crypto');
            if (!pin || a.length !== b.length || !timingSafeEqual(a, b)) {
                return NextResponse.json({ error: 'Invalid or missing PIN' }, { status: 403 });
            }
        }

        // 3. fileUrl ต้องเป็นไฟล์แนบของสัญญาใบนี้จริงเท่านั้น
        //    เดิมเอา fileUrl ที่ผู้เรียกส่งมาแปลงเป็น R2 key ตรงๆ โดยไม่ตรวจว่าเป็นของใคร
        //    → หาสัญญาที่ไม่ได้ตั้ง PIN สักใบ แล้วอ่าน object ไหนก็ได้ในทั้ง bucket
        const attachments: Array<{ url?: string }> = contractData.attachments ?? [];
        const matched = attachments.find((a) => a?.url === fileUrl);
        if (!matched?.url) {
            return NextResponse.json({ error: 'File not found for this contract' }, { status: 404 });
        }

        // 4. Proxy the file from R2 — key มาจาก URL ที่ผ่านการยืนยันแล้ว
        let key: string;
        try {
            key = new URL(matched.url).pathname.replace(/^\/+/, '');
        } catch {
            return NextResponse.json({ error: 'File not found for this contract' }, { status: 404 });
        }
        if (!key) {
            return NextResponse.json({ error: 'File not found for this contract' }, { status: 404 });
        }

        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
        });

        const { Body, ContentType } = await s3Client.send(command);

        if (!Body) {
            throw new Error('Empty file body');
        }

        // Convert stream to Buffer/Uint8Array for response
        const data = await Body.transformToByteArray();

        return new NextResponse(Buffer.from(data), {
            headers: {
                'Content-Type': ContentType || 'application/octet-stream',
                'Cache-Control': 'private, no-store',
            },
        });

    } catch (error) {
        console.error('File Proxy Error:', error);
        return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
    }
}
