'use client';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ContractData {
    employer: any; // Allow string or object
    employerId?: string;
    employerAddress?: string;
    contractor: any; // Allow string or object
    contractorId?: string;
    contractorAddress?: string;
    task: string;
    price: number;
    deposit: number;
    deadline: string;
    paymentTerms: string;
    attachments?: { name: string; url: string; type: string; }[];
    createdAt?: any;
    hideWatermark?: boolean;
}

// Format Thai date
function formatThaiDate(date: Date): string {
    const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543;
    return `${day} ${month} ${year}`;
}

// Format currency
function formatCurrency(amount: number): string {
    return amount.toLocaleString('th-TH');
}

// Helper to show value or blank placeholder
function valueOrBlank(value: string | undefined, placeholder = '______________________________'): string {
    if (!value || value === '_______' || value.trim() === '') {
        return placeholder;
    }
    return value;
}

export async function generateContractPDF(data: ContractData) {
    // Normalize data
    const employerName = typeof data.employer === 'string' ? data.employer : data.employer?.name;
    const employerId = typeof data.employer === 'string' ? data.employerId : (data.employer?.id_card || data.employerId);
    const employerAddress = typeof data.employer === 'string' ? data.employerAddress : (data.employer?.address || data.employerAddress);
    const employerSignature = typeof data.employer === 'object' ? data.employer?.signature : null;

    const contractorName = typeof data.contractor === 'string' ? data.contractor : data.contractor?.name;
    const contractorId = typeof data.contractor === 'string' ? data.contractorId : (data.contractor?.id_card || data.contractorId);
    const contractorAddress = typeof data.contractor === 'string' ? data.contractorAddress : (data.contractor?.address || data.contractorAddress);
    const contractorSignature = typeof data.contractor === 'object' ? data.contractor?.signature : null;

    const sharedStyles = `
        font-family: 'Sarabun', sans-serif;
        font-size: 15px;
        line-height: 1.8;
        color: #1e293b;
        width: 794px;
        height: 1122px;
        background: white;
        position: relative;
        padding: 80px 100px;
        box-sizing: border-box;
    `;

    const watermark = !data.hideWatermark ? `
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; z-index: 0; pointer-events: none; opacity: 0.03;">
            <img src="/images/logo-lawslane-transparent-color.png" style="width: 450px;" />
        </div>
    ` : '';

    const page1Content = `
    <div id="pdf-page-1" style="${sharedStyles}">
        ${watermark}
        <div style="position: relative; z-index: 10;">
            <div style="text-align: center; margin-bottom: 40px;">
                <h1 style="font-size: 32px; font-weight: bold; margin-bottom: 5px; color: #0f172a;">สัญญาจ้าง</h1>
                <p style="color: #64748b;">(ฉบับย่อ)</p>
            </div>

            <div style="text-align: right; margin-bottom: 40px;">
                <p>ทำที่: ${employerAddress ? 'ตามที่อยู่ผู้ว่าจ้าง' : 'ข้อตกลงออนไลน์'}</p>
                <p>วันที่: ${data.createdAt ? formatThaiDate(data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : formatThaiDate(new Date())}</p>
            </div>

            <div style="margin-bottom: 30px; text-align: justify; text-indent: 50px;">
                สัญญาฉบับนี้ทำขึ้นระหว่าง <strong>${employerName || '.....................'}</strong>
                บัตรประชาชนเลขที่ <strong>${employerId || '.....................'}</strong>
                อาศัยอยู่เลขที่ <strong>${employerAddress || '.....................'}</strong>
                ซึ่งต่อไปในสัญญานี้เรียกว่า "ผู้ว่าจ้าง" ฝ่ายหนึ่ง
            </div>

            <div style="margin-bottom: 30px; text-align: justify; text-indent: 50px;">
                กับ <strong>${contractorName || '.....................'}</strong>
                บัตรประชาชนเลขที่ <strong>${contractorId || '.....................'}</strong>
                อาศัยอยู่เลขที่ <strong>${contractorAddress || '.....................'}</strong>
                ซึ่งต่อไปในสัญญานี้เรียกว่า "ผู้รับจ้าง" อีกฝ่ายหนึ่ง
            </div>

            <p style="margin-bottom: 20px; text-indent: 50px;">คู่สัญญาทั้งสองฝ่ายตกลงทำสัญญากันดังมีข้อความต่อไปนี้:</p>

            <div style="margin-left: 30px; margin-bottom: 20px;">
                <p><strong>ข้อ 1. ขอบเขตของงาน</strong></p>
                <p style="padding-left: 30px; border-left: 2px solid #e2e8f0; color: #334155;">${data.task}</p>
            </div>

            <div style="margin-left: 30px; margin-bottom: 20px;">
                <p><strong>ข้อ 2. ค่าจ้างและเงื่อนไขการชำระเงิน</strong></p>
                <p style="padding-left: 30px;">
                    ผู้ว่าจ้างตกลงชำระค่าจ้างเป็นจำนวนเงินทั้งสิ้น <strong>${formatCurrency(data.price)} บาท</strong>
                    ${data.deposit > 0 ? `<br />- มัดจำ: <strong>${formatCurrency(data.deposit)} บาท</strong>` : ''}
                    <br />- เงื่อนไขการชำระเงิน: ${data.paymentTerms || 'ตามตกลงกัน'}
                </p>
            </div>

            <div style="margin-left: 30px;">
                <p><strong>ข้อ 3. กำหนดเวลาและสถานที่ส่งมอบงาน</strong></p>
                <p style="padding-left: 30px;">ผู้รับจ้างตกลงจะทำงานให้แล้วเสร็จภายใน <strong>${data.deadline}</strong></p>
            </div>
        </div>
        <div style="position: absolute; bottom: 40px; width: 100%; left: 0; text-align: center; font-size: 11px; color: #cbd5e1;">Page 1 of 2</div>
    </div>
    `;

    const page2Content = `
    <div id="pdf-page-2" style="${sharedStyles}">
        ${watermark}
        <div style="position: relative; z-index: 10;">
            <div style="margin-left: 30px; margin-bottom: 40px;">
                <p><strong>ข้อ 4. การบอกเลิกสัญญา</strong></p>
                <p style="padding-left: 30px;">หากผู้รับจ้างไม่สามารถทำงานให้แล้วเสร็จตามกำหนด หรือเจตนาทิ้งงาน ผู้ว่าจ้างมีสิทธิบอกเลิกสัญญาและเรียกร้องค่าเสียหายได้ทันที</p>
            </div>

            <p style="text-indent: 50px; margin-bottom: 50px; text-align: justify;">
                สัญญานี้เป็นการสรุปข้อตกลงเบื้องต้นจากการเจรจาผ่านทางแชท คู่สัญญาได้อ่านและเข้าใจข้อความโดยตลอดแล้ว จึงได้ลงลายมือชื่อผ่านระบบอิเล็กทรอนิกส์ไว้เป็นสำคัญ
            </p>

            ${data.attachments && data.attachments.length > 0 ? `
            <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <p style="font-weight: bold; margin-bottom: 15px;">เอกสารแนบท้ายสัญญา:</p>
                <ul style="padding-left: 20px;">
                    ${data.attachments.map(file => `<li style="margin-bottom: 5px;">${file.name}</li>`).join('')}
                </ul>
            </div>
            ` : ''}

            <div style="display: flex; justify-content: space-between; margin-top: 100px; padding: 0 40px;">
                <div style="text-align: center; width: 45%;">
                    <div style="border-bottom: 1px dotted #000; height: 80px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
                        ${employerSignature ? `<img src="${employerSignature}" style="max-height: 80px; object-fit: contain;" />` : ''}
                    </div>
                    <p>ลงชื่อ ผู้ว่าจ้าง</p>
                    <p style="color: #64748b;">( ${employerName || '.....................'} )</p>
                </div>
                <div style="text-align: center; width: 45%;">
                    <div style="border-bottom: 1px dotted #000; height: 80px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
                        ${contractorSignature ? `<img src="${contractorSignature}" style="max-height: 80px; object-fit: contain;" />` : ''}
                    </div>
                    <p>ลงชื่อ ผู้รับจ้าง</p>
                    <p style="color: #64748b;">( ${contractorName || '.....................'} )</p>
                </div>
            </div>

            <div style="text-align: center; margin-top: 120px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; pt-4">
                เอกสารนี้ถูกสร้างโดยระบบอัตโนมัติจาก Lawslane Capdeal
            </div>
        </div>
        <div style="position: absolute; bottom: 40px; width: 100%; left: 0; text-align: center; font-size: 11px; color: #cbd5e1;">Page 2 of 2</div>
    </div>
    `;

    // Create container for rendering
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.innerHTML = `<div>${page1Content}${page2Content}</div>`;
    document.body.appendChild(container);

    try {
        if (document.fonts) await document.fonts.ready;

        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Render Page 1
        const canvas1 = await html2canvas(document.getElementById('pdf-page-1')!, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });
        const imgData1 = canvas1.toDataURL('image/png');
        pdf.addImage(imgData1, 'PNG', 0, 0, 210, 297);

        // Add Page 2
        pdf.addPage();
        const canvas2 = await html2canvas(document.getElementById('pdf-page-2')!, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });
        const imgData2 = canvas2.toDataURL('image/png');
        pdf.addImage(imgData2, 'PNG', 0, 0, 210, 297);

        pdf.save(`contract-${employerName || 'legal'}-${Date.now()}.pdf`);
    } catch (error) {
        console.error('PDF Generation Error:', error);
        alert('เกิดข้อผิดพลาดในการสร้าง PDF กรุณาลองใหม่อีกครั้ง');
    } finally {
        document.body.removeChild(container);
    }
}
