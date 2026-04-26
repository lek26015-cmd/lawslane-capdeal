import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // This is a placeholder for the PDF generation logic.
    // In the future, this should either:
    // 1. Redirect to a pre-generated PDF in R2
    // 2. Call the Cloudflare Worker 'invoice-generator' to generate one on the fly.
    
    // For now, we'll return a helpful message or redirect to the UI page 
    // where they can see the invoice details.
    
    return NextResponse.json({
        error: "PDF generation is currently being migrated to the Capdeal engine.",
        message: "Please view the web version of the invoice to see all details.",
        invoiceId: id,
        viewUrl: `https://capdeal.lawslane.com/th/invoice/${id}`
    }, { status: 501 });
}
