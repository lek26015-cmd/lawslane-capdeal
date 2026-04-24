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

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
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

        // 2. Security Check
        if (contractData.isPinProtected) {
            if (!pin || pin !== contractData.sharePin) {
                return NextResponse.json({ error: 'Invalid or missing PIN' }, { status: 403 });
            }
        }

        // 3. Proxy the file from R2
        // Extract key from full URL (assuming it points to R2 public URL or contains the key)
        // Example: https://pub-xxx.r2.dev/contracts/id/attachments/file.pdf
        const urlParts = fileUrl.split('/');
        const key = urlParts.slice(3).join('/'); // Get everything after domain

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

        return new NextResponse(data, {
            headers: {
                'Content-Type': ContentType || 'application/octet-stream',
                'Cache-Control': 'public, max-age=3600',
            },
        });

    } catch (error) {
        console.error('File Proxy Error:', error);
        return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
    }
}
