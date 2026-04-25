'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { contractService, ContractData } from '@/services/contractService';
import { FadeIn } from '@/components/fade-in';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription 
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SignaturePad } from '@/components/ui/signature-pad';
import { 
    FileSignature, 
    Lock, 
    ShieldCheck, 
    PenTool, 
    CheckCircle, 
    AlertTriangle, 
    Loader2, 
    Paperclip, 
    Eye, 
    Download,
    FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { generateContractPDF } from '@/lib/contract-pdf';

const getContractLabels = (category: string = 'other') => {
    switch (category) {
        case 'employment':
        case 'service':
            return { title: 'สัญญาจ้าง', p1: 'ผู้ว่าจ้าง', p2: 'ผู้รับจ้าง', p1En: 'EMPLOYER', p2En: 'CONTRACTOR' };
        case 'sales':
            return { title: 'สัญญาซื้อขาย', p1: 'ผู้ซื้อ', p2: 'ผู้ขาย', p1En: 'BUYER', p2En: 'SELLER' };
        case 'loan':
            return { title: 'สัญญากู้ยืมเงิน', p1: 'ผู้ให้กู้', p2: 'ผู้กู้', p1En: 'LENDER', p2En: 'BORROWER' };
        case 'nda':
            return { title: 'สัญญาไม่เปิดเผยข้อมูล', p1: 'ผู้เปิดเผยข้อมูล', p2: 'ผู้รับข้อมูล', p1En: 'DISCLOSING PARTY', p2En: 'RECEIVING PARTY' };
        default:
            return { title: 'สัญญา', p1: 'คู่สัญญาฝ่ายที่หนึ่ง', p2: 'คู่สัญญาฝ่ายที่สอง', p1En: 'PARTY A', p2En: 'PARTY B' };
    }
};

export default function SharedContractPage() {
    const params = useParams();
    const id = params.id as string;

    const [contract, setContract] = useState<ContractData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPinVerified, setIsPinVerified] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState(false);
    
    const [signingRole, setSigningRole] = useState<'employer' | 'contractor' | null>(null);
    const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);
    const [showConfirmSign, setShowConfirmSign] = useState(false);
    const [pendingSignature, setPendingSignature] = useState<string | null>(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    useEffect(() => {
        if (!id) return;

        // Fetch initial data to check PIN requirement
        const fetchContract = async () => {
            try {
                const data = await contractService.getContract(id);
                setContract(data);
                
                // If not PIN protected, verify immediately
                if (data && !data.isPinProtected) {
                    setIsPinVerified(true);
                }
            } catch (error) {
                console.error('Failed to fetch contract:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchContract();

        // Subscribe for real-time updates (signatures, etc.)
        const unsubscribe = contractService.subscribeToContract(id, (data) => {
            setContract(data);
        });

        return () => unsubscribe();
    }, [id]);

    const handleVerifyPin = () => {
        if (contract && pinInput === contract.sharePin) {
            setIsPinVerified(true);
            setPinError(false);
        } else {
            setPinError(true);
            setPinInput('');
        }
    };

    const handleSign = async (signatureDataUrl: string) => {
        setPendingSignature(signatureDataUrl);
        setShowConfirmSign(true);
    };

    const handleConfirmSign = async () => {
        if (!signingRole || !contract || !pendingSignature) return;

        try {
            await contractService.signContract(id, signingRole, pendingSignature);
            setIsSignDialogOpen(false);
            setShowConfirmSign(false);
            setPendingSignature(null);
        } catch (error) {
            console.error('Error signing contract:', error);
            alert("ไม่สามารถบันทึกลายเซ็นได้ กรุณาลองใหม่อีกครั้ง");
        }
    };

    const handleDownloadPDF = async () => {
        if (!contract) return;
        setIsGeneratingPDF(true);
        try {
            await generateContractPDF({
                ...contract,
                hideWatermark: false // Standard for shared view
            } as any);
        } catch (error) {
            console.error('PDF generation failed:', error);
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return format(date, 'd MMMM yyyy HH:mm', { locale: th });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!contract) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="text-center space-y-4 max-w-md">
                    <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
                    <h1 className="text-2xl font-bold text-slate-800">ไม่พบสัญญา</h1>
                    <p className="text-slate-600">สัญญานี้อาจถูกลบหรือลิงก์ไม่ถูกต้อง กรุณาติดต่อเจ้าของสัญญา</p>
                </div>
            </div>
        );
    }

    // PIN Verification View
    if (!isPinVerified) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <FadeIn>
                    <Card className="w-full max-w-md border-none shadow-2xl rounded-3xl overflow-hidden bg-white">
                        <div className="bg-blue-600 p-8 text-white text-center">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                                <Lock className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold">สัญญาที่ได้รับการคุ้มครอง</h2>
                            <p className="text-blue-100 opacity-90 mt-1">กรุณาระบุ PIN 4 หลักเพื่อเข้าดูสัญญา</p>
                        </div>
                        <CardContent className="p-8 space-y-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-slate-600">PIN 4 หลัก</Label>
                                <Input 
                                    type="password" 
                                    maxLength={4}
                                    placeholder="••••"
                                    value={pinInput}
                                    onChange={(e) => {
                                        setPinInput(e.target.value.replace(/\D/g, ''));
                                        setPinError(false);
                                    }}
                                    className={`text-center text-3xl tracking-[1em] h-16 rounded-2xl border-2 ${pinError ? 'border-red-300 bg-red-50' : 'border-slate-100 focus:border-blue-500'}`}
                                />
                                {pinError && (
                                    <p className="text-red-500 text-sm text-center font-medium animate-shake">รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง</p>
                                )}
                            </div>
                            <Button 
                                onClick={handleVerifyPin}
                                disabled={pinInput.length !== 4}
                                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-95"
                            >
                                เข้าดูสัญญา
                            </Button>
                        </CardContent>
                    </Card>
                </FadeIn>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 md:px-6">
            <div className="container mx-auto max-w-4xl">
                <FadeIn direction="up">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
                                    <FileSignature className="w-8 h-8 text-blue-600" />
                                    {getContractLabels(contract.category).title}
                                </h1>
                                {contract.status === 'signed' ? (
                                    <Badge className="bg-green-100 text-green-700">เซ็นครบแล้ว</Badge>
                                ) : (
                                    <Badge className="bg-amber-100 text-amber-700">รอการเซ็น</Badge>
                                )}
                            </div>
                            <p className="text-slate-500 text-sm">เลขที่สัญญา: #{contract.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                        <Button
                            onClick={handleDownloadPDF}
                            disabled={isGeneratingPDF}
                            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm rounded-xl"
                        >
                            {isGeneratingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                            PDF
                        </Button>
                    </div>

                    <div className="space-y-8">
                        {/* Contract Document Preview (Mirroring the main app design) */}
                        <Card className="border-none shadow-2xl rounded-sm bg-white overflow-hidden relative min-h-[600px] flex flex-col">
                            <CardContent className="p-8 md:p-16 lg:p-20 space-y-8 font-serif leading-[1.8] text-slate-800 relative z-10">
                                <div className="text-center space-y-2 mb-12">
                                    <h2 className="text-3xl font-bold tracking-wide text-slate-900">{getContractLabels(contract.category).title}</h2>
                                    <p className="text-slate-400 font-sans text-sm">(ฉบับออนไลน์)</p>
                                </div>

                                <div className="space-y-6 text-[16px] md:text-[17px]">
                                    <p className="indent-12 text-justify">
                                        สัญญาฉบับนี้ทำขึ้นระหว่าง <strong>{contract.employer.name || '…………………………………………'}</strong> ({getContractLabels(contract.category).p1}) กับ <strong>{contract.contractor.name || '…………………………………………'}</strong> ({getContractLabels(contract.category).p2}) โดยมีรายละเอียดดังต่อไปนี้:
                                    </p>

                                    <div className="space-y-6 pt-4 pl-4 border-l-2 border-slate-100">
                                        <div>
                                            <p className="font-bold text-slate-900">ข้อ 1. ขอบเขตงาน</p>
                                            <div className="mt-2 text-slate-700 whitespace-pre-line text-sm md:text-base italic">
                                                "{contract.task}"
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <p className="font-bold text-slate-900">ข้อ 2. ค่าจ้าง</p>
                                                <p>จำนวนเงิน <strong>{contract.price.toLocaleString()}</strong> บาท</p>
                                                {contract.deposit ? <p>มัดจำ <strong>{contract.deposit.toLocaleString()}</strong> บาท</p> : null}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">ข้อ 3. กำหนดเวลา</p>
                                                <p>ภายใน <strong>{contract.deadline}</strong></p>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="font-bold text-slate-900">ข้อ 4. เงื่อนไขการชำระเงิน</p>
                                            <p>{contract.paymentTerms || 'ตามตกลงกัน'}</p>
                                        </div>
                                    </div>

                                    <p className="indent-12 mt-12 italic text-slate-500 text-sm">
                                        คู่สัญญาทั้งสองฝ่ายได้อ่านและเข้าใจข้อความโดยตลอดแล้ว จึงได้ลงลายมือชื่อผ่านระบบอิเล็กทรอนิกส์ไว้เป็นสำคัญ
                                    </p>
                                </div>

                                {/* Shared View Attachment List (Simplified) */}
                                {contract.attachments && contract.attachments.length > 0 && (
                                    <div className="mt-12 pt-8 border-t border-slate-100">
                                        <h3 className="font-bold text-slate-900 flex items-center text-sm uppercase tracking-wider mb-4">
                                            <Paperclip className="w-4 h-4 mr-2" />
                                            เอกสารแนบท้าย
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {contract.attachments.map((file, idx) => (
                                                <a 
                                                    key={idx}
                                                    href={`/api/share/contract/file?contractId=${contract.id}&fileUrl=${encodeURIComponent(file.url)}${contract.isPinProtected ? `&pin=${contract.sharePin}` : ''}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all group"
                                                >
                                                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center mr-3 shadow-sm group-hover:text-blue-600">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex-1 overflow-hidden">
                                                        <p className="text-xs font-medium text-slate-700 truncate">{file.name}</p>
                                                        <p className="text-[10px] text-slate-400 uppercase">{file.type?.split('/')[1] || 'FILE'}</p>
                                                    </div>
                                                    <Download className="w-4 h-4 text-slate-300 group-hover:text-blue-400" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Signature Section */}
                                <div className="mt-20 flex flex-col md:flex-row justify-around gap-12 text-center">
                                    {/* Employer Signature */}
                                    <div className="space-y-4 flex-1">
                                        <div className="h-24 border-b border-dotted border-slate-300 flex items-end justify-center pb-2">
                                            {contract.employer.signature ? (
                                                <img src={contract.employer.signature} alt="Signature" className="h-20 object-contain" />
                                            ) : (
                                                <Button 
                                                    variant="ghost" 
                                                    onClick={() => { setSigningRole('employer'); setIsSignDialogOpen(true); }}
                                                    className="text-blue-600 hover:bg-blue-50 gap-2 h-16 w-full max-w-[200px] border-2 border-dashed border-blue-100 rounded-xl"
                                                >
                                                    <PenTool className="w-4 h-4" />
                                                    เซ็นชื่อ ({getContractLabels(contract.category).p1})
                                                </Button>
                                            )}
                                        </div>
                                        <div className="text-sm">
                                            <p className="font-bold text-slate-800">{getContractLabels(contract.category).p1}</p>
                                            <p className="text-slate-500">( {contract.employer.name || '…………………………………………'} )</p>
                                            {contract.employer.signedAt && <p className="text-[10px] text-slate-400 mt-1">{formatDate(contract.employer.signedAt)}</p>}
                                        </div>
                                    </div>

                                    {/* Contractor Signature */}
                                    <div className="space-y-4 flex-1">
                                        <div className="h-24 border-b border-dotted border-slate-300 flex items-end justify-center pb-2">
                                            {contract.contractor.signature ? (
                                                <img src={contract.contractor.signature} alt="Signature" className="h-20 object-contain" />
                                            ) : (
                                                <Button 
                                                    variant="ghost" 
                                                    onClick={() => { setSigningRole('contractor'); setIsSignDialogOpen(true); }}
                                                    className="text-blue-600 hover:bg-blue-50 gap-2 h-16 w-full max-w-[200px] border-2 border-dashed border-blue-100 rounded-xl"
                                                >
                                                    <PenTool className="w-4 h-4" />
                                                    เซ็นชื่อ ({getContractLabels(contract.category).p2})
                                                </Button>
                                            )}
                                        </div>
                                        <div className="text-sm">
                                            <p className="font-bold text-slate-800">{getContractLabels(contract.category).p2}</p>
                                            <p className="text-slate-500">( {contract.contractor.name || '…………………………………………'} )</p>
                                            {contract.contractor.signedAt && <p className="text-[10px] text-slate-400 mt-1">{formatDate(contract.contractor.signedAt)}</p>}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </FadeIn>
            </div>

            {/* Signing Dialog */}
            <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
                <DialogContent className="sm:max-w-md bg-white border-none shadow-2xl rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                            <PenTool className="w-5 h-5 text-blue-600" />
                            ลงลายมือชื่อ
                        </DialogTitle>
                        <DialogDescription className="text-slate-500">
                            กรุณาเซ็นชื่อในฐานะ {signingRole === 'employer' ? getContractLabels(contract.category).p1 : getContractLabels(contract.category).p2} เพื่อยืนยันสัญญา
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6">
                        <SignaturePad onSave={handleSign} />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Confirmation Dialog */}
            <AlertDialog open={showConfirmSign} onOpenChange={setShowConfirmSign}>
                <AlertDialogContent className="bg-white border-none shadow-2xl rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">ยืนยันการเซ็นชื่อ</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-600">
                            ลายเซ็นนี้จะมีผลผูกพันทางกฎหมายและไม่สามารถแก้ไขได้ คุณต้องการดำเนินการต่อใช่หรือไม่?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="rounded-xl border-slate-100">ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleConfirmSign}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 font-bold"
                        >
                            ยืนยันและเซ็นสัญญา
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
