import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { requireUser, authErrorResponse } from '@/lib/auth-guard';
import { consumeQuota, QuotaError } from '@/lib/entitlement';

/**
 * สร้างสัญญา + ตัดโควตาใน transaction เดียว
 * เดิม client setDoc เองแล้วเช็คโควตาใน UI — ข้ามได้ และลบสัญญาเก่าเพื่อรีเซ็ตโควตาได้
 */
const CATEGORIES = ['employment', 'sales', 'loan', 'service', 'nda', 'other'];

function str(v: unknown, max: number): string {
    return typeof v === 'string' ? v.slice(0, max) : '';
}

function money(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, 1e12) : 0;
}

function party(p: any) {
    const out: Record<string, string> = { name: str(p?.name, 200) };
    if (p?.email) out.email = str(p.email, 200);
    if (p?.id_card) out.id_card = str(p.id_card, 50);
    if (p?.address) out.address = str(p.address, 500);
    return out;
}

// ฉบับแก้ไขพาไฟล์แนบเดิมมาด้วย — รับเฉพาะไฟล์ใน prefix contracts/ ของ bucket เรา
function attachments(list: unknown) {
    if (!Array.isArray(list)) return [];
    const base = process.env.R2_PUBLIC_URL;
    return list
        .filter((a) => typeof a?.url === 'string' && base && a.url.startsWith(`${base}/contracts/`))
        .slice(0, 20)
        .map((a) => ({ name: str(a.name, 200), url: a.url as string, type: str(a.type, 100) }));
}

export async function POST(req: Request) {
    let session;
    try {
        session = await requireUser();
    } catch (e) {
        return authErrorResponse(e);
    }

    const body = await req.json().catch(() => ({}));
    const db = session.adminApp.firestore();
    const id = randomUUID();
    const ref = db.collection('contracts').doc(id);

    const contract = {
        id,
        ownerId: session.uid,
        title: str(body?.title, 200) || 'สัญญาจ้างทำของ',
        category: CATEGORIES.includes(body?.category) ? body.category : 'other',
        notes: str(body?.notes, 5000),
        employer: party(body?.employer),
        contractor: party(body?.contractor),
        task: str(body?.task, 10000),
        price: money(body?.price),
        deposit: money(body?.deposit),
        deadline: str(body?.deadline, 200),
        paymentTerms: str(body?.paymentTerms, 2000),
        attachments: attachments(body?.attachments),
        status: 'draft',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };

    try {
        const usage = await consumeQuota(db, session.uid, 'deals', (tx) => tx.create(ref, contract));
        return NextResponse.json({ id, usage });
    } catch (error) {
        if (error instanceof QuotaError) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
        }
        console.error('CONTRACT_CREATE_ERROR', error);
        return NextResponse.json({ error: 'ไม่สามารถสร้างสัญญาได้' }, { status: 500 });
    }
}
