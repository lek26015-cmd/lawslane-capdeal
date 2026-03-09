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
    // Normalize data (Handle both flat and nested structures)
    const employerName = typeof data.employer === 'string' ? data.employer : data.employer?.name;
    const employerId = typeof data.employer === 'string' ? data.employerId : (data.employer?.id_card || data.employerId);
    const employerAddress = typeof data.employer === 'string' ? data.employerAddress : (data.employer?.address || data.employerAddress);
    const employerSignature = typeof data.employer === 'object' ? data.employer?.signature : null;

    const contractorName = typeof data.contractor === 'string' ? data.contractor : data.contractor?.name;
    const contractorId = typeof data.contractor === 'string' ? data.contractorId : (data.contractor?.id_card || data.contractorId);
    const contractorAddress = typeof data.contractor === 'string' ? data.contractorAddress : (data.contractor?.address || data.contractorAddress);
    const contractorSignature = typeof data.contractor === 'object' ? data.contractor?.signature : null;

    const blankLine = '______________________________';
    const shortBlank = '___________________';
    const idBlank = '______________________';

    const htmlContent = `
    <div style="font-family: 'Sarabun', sans-serif; font-size: 14px; line-height: 1.6; color: #333; padding: 40px 50px; width: 794px; background: white; position: relative; overflow: hidden;">
        <!-- Watermark -->
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; z-index: 0; pointer-events: none;">
            <span style="font-size: 120px; font-weight: bold; color: rgba(11, 57, 121, 0.05); transform: rotate(-45deg); white-space: nowrap; text-transform: uppercase; letter-spacing: 12px; font-family: sans-serif;">Lawslane</span>
        </div>
        
        <div style="position: relative; z-index: 10;">
            <h1 class="title" style="text-align: center; font-size: 24px; font-weight: bold; color: #0B3979; margin-bottom: 5px;">สัญญาจ้าง</h1>
        <p class="subtitle" style="text-align: center; font-size: 16px; color: #666; margin-bottom: 20px;">(ฉบับย่อ)</p>
        
        <p class="date" style="text-align: right; margin-bottom: 15px; font-size: 14px;">วันที่: ${formatThaiDate(new Date())}</p>
        
        <div class="section" style="margin-bottom: 15px;">
            <p>สัญญาฉบับนี้ทำขึ้นระหว่าง</p>
            
            <div class="party-box" style="display: flex; gap: 30px; margin: 15px 0;">
                <div class="party-info" style="flex: 1; padding: 15px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                    <h4 style="font-size: 13px; color: #64748b; margin-bottom: 8px; text-transform: uppercase;">ผู้ว่าจ้าง</h4>
                    <p><span style="color: #64748b; font-size: 12px;">ชื่อ:</span> <span class="${employerName ? 'value' : 'blank'}" style="${employerName ? 'color: #0B3979; font-weight: bold;' : 'color: #999;'}">${valueOrBlank(employerName)}</span></p>
                    <p><span style="color: #64748b; font-size: 12px;">บัตรประชาชน:</span> <span class="${employerId ? 'value' : 'blank'}" style="${employerId ? 'color: #0B3979; font-weight: bold;' : 'color: #999;'}">${valueOrBlank(employerId, idBlank)}</span></p>
                    <p><span style="color: #64748b; font-size: 12px;">ที่อยู่:</span> <span class="${employerAddress ? 'value' : 'blank'}" style="${employerAddress ? 'color: #0B3979; font-weight: bold;' : 'color: #999;'}">${valueOrBlank(employerAddress, blankLine)}</span></p>
                </div>
                
                <div class="party-info" style="flex: 1; padding: 15px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                    <h4 style="font-size: 13px; color: #64748b; margin-bottom: 8px; text-transform: uppercase;">ผู้รับจ้าง</h4>
                    <p><span style="color: #64748b; font-size: 12px;">ชื่อ:</span> <span class="${contractorName ? 'value' : 'blank'}" style="${contractorName ? 'color: #0B3979; font-weight: bold;' : 'color: #999;'}">${valueOrBlank(contractorName)}</span></p>
                    <p><span style="color: #64748b; font-size: 12px;">บัตรประชาชน:</span> <span class="${contractorId ? 'value' : 'blank'}" style="${contractorId ? 'color: #0B3979; font-weight: bold;' : 'color: #999;'}">${valueOrBlank(contractorId, idBlank)}</span></p>
                    <p><span style="color: #64748b; font-size: 12px;">ที่อยู่:</span> <span class="${contractorAddress ? 'value' : 'blank'}" style="${contractorAddress ? 'color: #0B3979; font-weight: bold;' : 'color: #999;'}">${valueOrBlank(contractorAddress, blankLine)}</span></p>
                </div>
            </div>
            
            <p style="margin-top: 10px;">โดยทั้งสองฝ่ายตกลงทำสัญญากันดังมีข้อความต่อไปนี้</p>
        </div>
        
        <p class="clause-title" style="font-size: 15px; font-weight: bold; color: #DC7800; margin-top: 20px; margin-bottom: 5px;">ข้อ 1. เนื้องานที่จ้าง</p>
        <p>ผู้รับจ้างตกลงรับจ้างทำงาน: <span style="color: #0B3979; font-weight: bold;">${valueOrBlank(data.task)}</span></p>
        
        <p class="clause-title" style="font-size: 15px; font-weight: bold; color: #DC7800; margin-top: 20px; margin-bottom: 5px;">ข้อ 2. ค่าจ้างและการชำระเงิน</p>
        <p>ตกลงค่าจ้างเป็นจำนวนเงินทั้งสิ้น: ${data.price ? `<span style="color: #008000; font-weight: bold;">${formatCurrency(data.price)} บาท</span>` : `<span style="color: #999;">${shortBlank}</span> บาท`}${(data.deposit && data.deposit > 0) ? ` (มัดจำแล้ว: <span style="color: #008000; font-weight: bold;">${formatCurrency(data.deposit)}</span> บาท)` : ''}</p>
        <p>การชำระเงินส่วนที่เหลือ: <span style="color: #0B3979; font-weight: bold;">${valueOrBlank(data.paymentTerms)}</span></p>
        
        <p class="clause-title" style="font-size: 15px; font-weight: bold; color: #DC7800; margin-top: 20px; margin-bottom: 5px;">ข้อ 3. กำหนดการส่งมอบงาน</p>
        <p>ผู้รับจ้างตกลงจะทำงานให้แล้วเสร็จภายใน: <span style="color: #0B3979; font-weight: bold;">${valueOrBlank(data.deadline)}</span></p>
        
        <p class="clause-title" style="font-size: 15px; font-weight: bold; color: #DC7800; margin-top: 20px; margin-bottom: 5px;">ข้อ 4. การบอกเลิกสัญญา</p>
        <p>หากผู้รับจ้างไม่สามารถทำงานให้แล้วเสร็จตามกำหนด หรือเจตนาทิ้งงาน ผู้ว่าจ้างมีสิทธิบอกเลิกสัญญาและเรียกร้องค่าเสียหายได้ทันที</p>
        
        ${data.attachments && data.attachments.length > 0 ? `
        <p class="clause-title" style="font-size: 15px; font-weight: bold; color: #DC7800; margin-top: 20px; margin-bottom: 5px;">เอกสารแนบท้ายสัญญา</p>
        <ul style="padding-left: 20px;">
            ${data.attachments.map(file => `<li>${file.name}</li>`).join('')}
        </ul>
        ` : ''}

        <div class="signatures" style="display: flex; justify-content: space-between; margin-top: 60px; padding: 0 40px;">
            <div class="signature-block" style="text-align: center; width: 40%;">
                <div class="signature-line" style="border-bottom: 1px solid #000; margin-bottom: 8px; height: 60px; display: flex; align-items: flex-end; justify-content: center;">
                    ${employerSignature ? `<img src="${employerSignature}" style="max-height: 80px; object-fit: contain;" />` : ''}
                </div>
                <p style="font-size: 13px; margin: 3px 0;">ลงชื่อ ผู้ว่าจ้าง</p>
                <p style="font-size: 13px; margin: 3px 0;">(${valueOrBlank(employerName, '.....................')})</p>
            </div>
            <div class="signature-block" style="text-align: center; width: 40%;">
                <div class="signature-line" style="border-bottom: 1px solid #000; margin-bottom: 8px; height: 60px; display: flex; align-items: flex-end; justify-content: center;">
                    ${contractorSignature ? `<img src="${contractorSignature}" style="max-height: 80px; object-fit: contain;" />` : ''}
                </div>
                <p style="font-size: 13px; margin: 3px 0;">ลงชื่อ ผู้รับจ้าง</p>
                <p style="font-size: 13px; margin: 3px 0;">(${valueOrBlank(contractorName, '.....................')})</p>
            </div>
        </div>
        
        <p class="footer" style="text-align: center; margin-top: 50px; font-size: 11px; color: #999;">เอกสารนี้ถูกสร้างโดยระบบอัตโนมัติจาก Lawslane</p>
        </div>
    </div>
    `;

    // Create dummy container for rendering
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    try {
        // Wait for fonts to load if possible
        if (document.fonts) {
            await document.fonts.ready;
        }

        const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
        } as any);

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Calculate dimensions manually to avoid getImageProperties lint error
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`contract-${Date.now()}.pdf`);
    } catch (error) {
        console.error('PDF Generation Error:', error);
        alert('เกิดข้อผิดพลาดในการสร้าง PDF กรุณาลองใหม่อีกครั้ง');
    } finally {
        document.body.removeChild(container);
    }
}
