'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { invoiceService, InvoiceData } from '@/services/invoiceService';
import { FadeIn } from '@/components/fade-in';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FileText, CheckCircle, Clock, AlertTriangle, ArrowLeft, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function InvoicePage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [invoice, setInvoice] = useState<InvoiceData | null>(null);
    const [lawyer, setLawyer] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        const fetchData = async () => {
            try {
                const data = await invoiceService.getInvoice(id);
                if (!data) {
                    setError("NOT_FOUND");
                    setInvoice(null);
                } else {
                    setInvoice(data);
                    setError(null);

                    if (data.lawyerId) {
                        const { firestore } = initializeFirebase();
                        if (firestore) {
                            const lawyerDoc = await getDoc(doc(firestore, 'lawyerProfiles', data.lawyerId));
                            if (lawyerDoc.exists()) {
                                setLawyer(lawyerDoc.data());
                            }
                        }
                    }
                }
            } catch (err: any) {
                console.error("Error fetching invoice:", err);
                setError(err.message || "An unexpected error occurred");
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Subscribe for real-time updates (e.g. status changes)
        const unsubscribe = invoiceService.subscribeToInvoice(id, (data) => {
            setInvoice(data);
        });

        return () => unsubscribe();
    }, [id]);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return format(date, 'd MMMM yyyy', { locale: th });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
                    <p className="text-slate-500">กำลังโหลดเอกสาร...</p>
                </div>
            </div>
        );
    }

    if (error && error !== "NOT_FOUND") {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
                <div className="text-center space-y-6 max-w-md">
                    <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                        <AlertTriangle className="w-10 h-10 text-amber-500" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-slate-800">เกิดข้อผิดพลาดในการโหลดข้อมูล</h1>
                        <p className="text-slate-600 font-mono text-xs p-3 bg-slate-100 rounded-lg">{error}</p>
                    </div>
                    <Button 
                        onClick={() => window.location.reload()}
                        className="bg-slate-800 hover:bg-black text-white w-full py-6 rounded-xl text-lg font-bold shadow-lg"
                    >
                        ลองใหม่อีกครั้ง
                    </Button>
                </div>
            </div>
        );
    }

    if (!invoice || error === "NOT_FOUND") {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
                <div className="text-center space-y-6 max-w-md">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                        <AlertTriangle className="w-10 h-10 text-red-500" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-slate-800">ไม่พบเอกสารที่ต้องการ</h1>
                        <p className="text-slate-600">เอกสารรหัส <span className="font-mono font-bold text-slate-900">{id}</span> อาจถูกลบ ย้าย หรือไม่มีอยู่ในระบบ กรุณาตรวจสอบลิงก์อีกครั้ง</p>
                    </div>
                    <Button 
                        onClick={() => window.location.href = 'https://lawslane.com'}
                        className="bg-blue-600 hover:bg-blue-700 text-white w-full py-6 rounded-xl text-lg font-bold shadow-lg shadow-blue-900/20"
                    >
                        กลับสู่หน้าหลัก Lawslane
                    </Button>
                </div>
            </div>
        );
    }

    const StatusBadge = () => {
        if (invoice.status === 'paid') {
            return (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 px-4 py-1.5 rounded-full flex items-center gap-1.5 border border-emerald-200">
                    <CheckCircle className="w-4 h-4" />
                    ชำระเงินแล้ว
                </Badge>
            );
        }
        return (
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 px-4 py-1.5 rounded-full flex items-center gap-1.5 border border-amber-200">
                <Clock className="w-4 h-4" />
                รอการชำระ
            </Badge>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 py-8 md:py-16 px-4">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Top Action Bar */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full hover:bg-white shadow-sm"
                            onClick={() => window.history.back()}
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-500" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">{invoice.type === 'proposal' ? 'ใบเสนอราคา' : 'ใบแจ้งหนี้'}</h1>
                            <p className="text-sm text-slate-500">#{invoice.id.toUpperCase().slice(0, 8)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Button 
                            variant="outline" 
                            className="flex-1 md:flex-none border-slate-200 text-slate-600 hover:bg-white"
                            onClick={() => window.print()}
                        >
                            <Printer className="w-4 h-4 mr-2" />
                            พิมพ์เอกสาร
                        </Button>
                        <Button 
                            className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/10"
                            onClick={() => alert('กำลังพัฒนาฟีเจอร์ดาวน์โหลด PDF')}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            ดาวน์โหลด PDF
                        </Button>
                    </div>
                </div>

                <FadeIn direction="up">
                    <Card className="border-none shadow-2xl rounded-none md:rounded-sm overflow-hidden bg-white">
                        <CardContent className="p-8 md:p-16 space-y-12 relative">
                            {/* Watermark for Paid */}
                            {invoice.status === 'paid' && (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 opacity-[0.05] pointer-events-none z-0">
                                    <h2 className="text-[150px] font-black border-[20px] border-emerald-600 text-emerald-600 px-20 py-10 rounded-3xl uppercase tracking-widest">PAID</h2>
                                </div>
                            )}

                            {/* Header Section */}
                            <div className="flex flex-col md:flex-row justify-between items-start gap-8 relative z-10">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <img src="/images/logo-lawslane-transparent-color.png" alt="Lawslane" className="h-10 md:h-12" />
                                        <div className="h-8 w-px bg-slate-200 hidden md:block" />
                                        <span className="text-lg font-bold text-[#0B3979] hidden md:block">Lawslane Capdeal</span>
                                    </div>
                                    <div className="space-y-1">
                                        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                                            {invoice.type === 'proposal' ? 'QUOTATION' : 'INVOICE'}
                                        </h2>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400 text-sm">STATUS:</span>
                                            <StatusBadge />
                                        </div>
                                    </div>
                                </div>

                                <div className="text-left md:text-right space-y-2">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Document No.</p>
                                        <p className="text-lg font-mono font-bold text-slate-800">#{invoice.id.toUpperCase().slice(0, 12)}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Date Issued</p>
                                        <p className="text-base font-medium text-slate-700">{formatDate(invoice.createdAt)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid md:grid-cols-2 gap-12 border-t border-b border-slate-100 py-10 relative z-10">
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Issued By</h3>
                                    <div className="space-y-1">
                                        <p className="text-lg font-bold text-slate-900">{lawyer?.name || 'ทนายความผู้เชี่ยวชาญ'}</p>
                                        <p className="text-slate-500 text-sm">{lawyer?.licenseNumber ? `ใบอนุญาตเลขที่: ${lawyer.licenseNumber}` : 'ทนายความในเครือ Lawslane'}</p>
                                        <p className="text-slate-500 text-sm">{lawyer?.firmName || 'Lawslane Network Partner'}</p>
                                    </div>
                                </div>
                                <div className="space-y-4 text-left md:text-right">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bill To</h3>
                                    <div className="space-y-1">
                                        <p className="text-lg font-bold text-slate-900">{invoice.clientInfo?.name || 'ลูกความผู้ทรงเกียรติ'}</p>
                                        <p className="text-slate-500 text-sm">{invoice.clientInfo?.address || '-'}</p>
                                        {invoice.clientInfo?.taxId && (
                                            <p className="text-slate-500 text-sm">เลขผู้เสียภาษี: {invoice.clientInfo.taxId}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="space-y-6 relative z-10">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Project Details: {invoice.title}</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b-2 border-slate-900">
                                                <th className="py-4 text-sm font-bold text-slate-900 uppercase">Description</th>
                                                <th className="py-4 text-sm font-bold text-slate-900 uppercase text-right">Amount (THB)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {invoice.items && invoice.items.length > 0 ? (
                                                invoice.items.map((item, index) => (
                                                    <tr key={index}>
                                                        <td className="py-5 text-slate-700">{item.description}</td>
                                                        <td className="py-5 text-slate-900 font-medium text-right">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td className="py-5 text-slate-700">ค่าบริการวิชาชีพกฎหมาย</td>
                                                    <td className="py-5 text-slate-900 font-medium text-right">{invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-slate-900">
                                                <td className="py-6 text-lg font-bold text-slate-900">Total Amount</td>
                                                <td className="py-6 text-2xl font-black text-[#0B3979] text-right">฿{invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Payment Instructions / Notes */}
                            <div className="grid md:grid-cols-2 gap-12 pt-8 relative z-10">
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Payment Method</h3>
                                    <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xs">QR</div>
                                            <p className="text-sm font-bold text-slate-800">Thai QR Payment / PromptPay</p>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            กรุณาชำระเงินผ่านเมนู "ชำระเงิน" ในหน้าแชท Lawslane เพื่อความปลอดภัยของท่าน เงินของท่านจะถูกเก็บไว้ในระบบ Escrow จนกว่างานจะสำเร็จ
                                        </p>
                                        <Button 
                                            className="w-full bg-slate-900 hover:bg-black text-white text-xs font-bold py-2 h-auto"
                                            onClick={() => window.location.href = `https://lawslane.com/th/payment?chatId=${invoice.chatId}&type=case`}
                                        >
                                            ดำเนินการชำระเงินทันที
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Terms & Conditions</h3>
                                    <ul className="text-xs text-slate-500 space-y-2 list-disc pl-4">
                                        <li>เอกสารนี้ออกโดยระบบ Lawslane Capdeal เพื่อใช้ประกอบการเสนอราคาและการชำระเงิน</li>
                                        <li>ยอดเงินทั้งหมดจะถูกพักไว้ในระบบ Lawslane และจะโอนให้ทนายความเมื่อมีการส่งมอบงานตามงวดที่ตกลงกัน</li>
                                        <li>กรณีมีข้อพิพาท กรุณาติดต่อฝ่ายสนับสนุนลูกค้าของ Lawslane ทันที</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Footer Signature Section */}
                            <div className="pt-16 flex flex-col md:flex-row justify-between items-end gap-12 border-t border-slate-100 relative z-10">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-emerald-600/30">
                                        <ShieldCheck className="w-12 h-12" />
                                        <div className="text-[10px] font-bold uppercase tracking-widest leading-none">
                                            Verified by<br/>Lawslane
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">Digital Security Seal</p>
                                </div>
                                <div className="text-center min-w-[200px] space-y-4">
                                    <div className="h-px bg-slate-300 w-full mb-2" />
                                    <p className="text-sm font-bold text-slate-800">ผู้มีอำนาจลงนาม / ทนายความ</p>
                                    <p className="text-xs text-slate-400 uppercase tracking-widest">Authorized Signature</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </FadeIn>

                {/* Bottom Helper */}
                <div className="text-center space-y-4 pb-12">
                    <p className="text-slate-400 text-sm">
                        สัญญานี้เป็นเอกสารอิเล็กทรอนิกส์ จัดทำขึ้นภายใต้พระราชบัญญัติว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ พ.ศ. 2544
                    </p>
                    <div className="flex items-center justify-center gap-6">
                        <img src="/images/logo-lawslane-transparent-color.png" alt="Lawslane" className="h-6 opacity-30" />
                    </div>
                </div>
            </div>
        </div>
    );
}
