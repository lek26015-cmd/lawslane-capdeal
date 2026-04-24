'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { contractService, ContractData } from '@/services/contractService';
import { FadeIn } from '@/components/fade-in';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
import { FileSignature, AlertTriangle, Shield, CheckCircle, Edit, Plus, Calendar, User, Download, Link as LinkIcon, Share2, Loader2, Paperclip, Lock, FileText, Trash2, Eye, X, PenTool, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { generateContractPDF } from '@/lib/contract-pdf';
import { useUser } from '@/firebase';
import { useSubscription } from '@/hooks/useSubscription';
import { uploadToR2 } from '@/app/actions/upload-r2';

export default function ContractSigningPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    // Auth & Subscription
    const { user } = useUser();
    const { isActive, isLoading: isSubLoading, planId } = useSubscription();

    const hideWatermark = planId && planId !== 'free';

    const [contract, setContract] = useState<ContractData | null>(null);
    const [loading, setLoading] = useState(true);
    const [signingRole, setSigningRole] = useState<'employer' | 'contractor' | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Edit & Revise states
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<ContractData>>({});
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [isCreatingRevision, setIsCreatingRevision] = useState(false);
    const [copied, setCopied] = useState(false);

    // Upload states
    const [isUploading, setIsUploading] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [showFullView, setShowFullView] = useState(false);
    const [showConfirmSign, setShowConfirmSign] = useState(false);
    const [pendingSignature, setPendingSignature] = useState<string | null>(null);
    const [showESignInfo, setShowESignInfo] = useState(false);

    useEffect(() => {
        if (!id) return;

        const unsubscribe = contractService.subscribeToContract(id, (data) => {
            setContract(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [id]);

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy link', err);
        }
    };

    const handleEditSave = async () => {
        if (!contract || !editData) return;
        setIsSavingEdit(true);
        try {
            await contractService.updateContract(contract.id, editData);
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to update contract:', error);
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleCreateRevision = async () => {
        if (!contract) return;
        setIsCreatingRevision(true);

        try {
            // Create a new contract based on the current one but without signatures
            const newContractId = await contractService.createContract({
                ...contract,
                title: `${contract.title || 'สัญญาจ้างทำของ'} (ฉบับแก้ไข)`,
                task: `${contract.task}\n\n(อ้างอิงและแก้ไขจากสัญญาฉบับเดิม: #${contract.id.slice(0, 8).toUpperCase()})`,
                status: 'pending',
                employer: {
                    ...contract.employer,
                    signature: undefined,
                    signedAt: undefined
                },
                contractor: {
                    ...contract.contractor,
                    signature: undefined,
                    signedAt: undefined
                }
            });

            // Redirect to the new contract
            router.push(`/th/contract/${newContractId}`);
        } catch (error) {
            console.error('Failed to create revision:', error);
            setIsCreatingRevision(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length || !contract || !user) return;

        const file = e.target.files[0];
        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            // Upload to Cloudflare R2
            const fileUrl = await uploadToR2(formData, `contracts/${contract.id}/attachments`);

            const newAttachment = {
                name: file.name,
                url: fileUrl,
                type: file.type
            };

            const updatedAttachments = [...(contract.attachments || []), newAttachment];

            await contractService.updateContract(contract.id, {
                attachments: updatedAttachments
            });

        } catch (error) {
            console.error("Failed to upload attachment:", error);
            alert("ไม่สามารถอัปโหลดไฟล์ได้ กรุณาลองใหม่อีกครั้ง");
        } finally {
            setIsUploading(false);
            // Reset input so the same file can be selected again if needed
            e.target.value = '';
        }
    };

    const handleDeleteAttachment = async (indexToRemove: number) => {
        if (!contract || !contract.attachments) return;

        try {
            const updatedAttachments = contract.attachments.filter((_, idx) => idx !== indexToRemove);

            await contractService.updateContract(contract.id, {
                attachments: updatedAttachments
            });
        } catch (error) {
            console.error("Failed to delete attachment:", error);
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
            setIsDialogOpen(false);
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
                hideWatermark
            } as any);
        } catch (error) {
            console.error('PDF generation failed:', error);
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
                    <p className="text-slate-500">กำลังโหลดข้อมูลสัญญา...</p>
                </div>
            </div>
        );
    }

    if (!contract) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center space-y-4">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                    <h1 className="text-2xl font-bold text-slate-800">ไม่พบสัญญา</h1>
                    <p className="text-slate-600">สัญญานี้อาจถูกลบหรือไม่มีอยู่ในระบบ</p>
                </div>
            </div>
        );
    }

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '-';
        // Handle Firestore Timestamp
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return format(date, 'd MMMM yyyy HH:mm', { locale: th });
    };

    const StatusBadge = () => {
        if (contract.status === 'signed') {
            return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 px-3 py-1">เซ็นครบแล้ว (Signed)</Badge>;
        }
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 px-3 py-1">รอการเซ็น (Pending)</Badge>;
    };

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 md:px-6">
            <div className="container mx-auto max-w-6xl">
                <FadeIn direction="up">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
                                    <FileSignature className="w-8 h-8 text-blue-600" />
                                    สัญญาจ้างงาน
                                </h1>
                                <StatusBadge />
                            </div>
                            <p className="text-slate-500">เลขที่สัญญา: <span className="font-mono text-xs text-slate-400">#{contract.id.slice(0, 8).toUpperCase()}</span></p>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
                            {/* Only show management buttons to the contract owner */}
                            {user?.uid === contract.ownerId && (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={handleShare}
                                        className="border-blue-200 text-blue-700 hover:bg-blue-50"
                                    >
                                        {copied ? <CheckCircle className="w-4 h-4 mr-2" /> : <LinkIcon className="w-4 h-4 mr-2" />}
                                        {copied ? 'คัดลอกลิงก์แล้ว' : 'แชร์สัญญานี้'}
                                    </Button>

                                    {contract.status !== 'signed' && !contract.employer.signature && !contract.contractor.signature && (
                                        <Dialog open={isEditing} onOpenChange={(open) => {
                                            if (open) setEditData(contract);
                                            setIsEditing(open);
                                        }}>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50">
                                                    <Edit className="w-4 h-4 mr-2" />
                                                    แก้ไขข้อตกลง
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                                <DialogHeader>
                                                    <DialogTitle>แก้ไขรายละเอียดสัญญา</DialogTitle>
                                                    <DialogDescription>
                                                        แก้ไขข้อมูลรายละเอียดของสัญญาจ้างได้ตราบใดที่ยังไม่มีใครลงนาม
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    {/* Employer Details */}
                                                    <div className="p-4 bg-slate-50 rounded-lg space-y-4">
                                                        <h3 className="font-medium text-slate-800 border-b pb-2">ผู้ว่าจ้าง (Employer)</h3>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <Label>ชื่อผู้ว่าจ้าง</Label>
                                                                <Input
                                                                    value={editData.employer?.name || ''}
                                                                    onChange={(e) => setEditData({
                                                                        ...editData,
                                                                        employer: { ...editData.employer!, name: e.target.value }
                                                                    })}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>เลขประจำตัวประชาชน / เลขผู้เสียภาษี</Label>
                                                                <Input
                                                                    value={editData.employer?.id_card || ''}
                                                                    onChange={(e) => setEditData({
                                                                        ...editData,
                                                                        employer: { ...editData.employer!, id_card: e.target.value }
                                                                    })}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>ที่อยู่</Label>
                                                            <Input
                                                                value={editData.employer?.address || ''}
                                                                onChange={(e) => setEditData({
                                                                    ...editData,
                                                                    employer: { ...editData.employer!, address: e.target.value }
                                                                })}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Contractor Details */}
                                                    <div className="p-4 bg-slate-50 rounded-lg space-y-4">
                                                        <h3 className="font-medium text-slate-800 border-b pb-2">ผู้รับจ้าง (Contractor)</h3>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <Label>ชื่อผู้รับจ้าง</Label>
                                                                <Input
                                                                    value={editData.contractor?.name || ''}
                                                                    onChange={(e) => setEditData({
                                                                        ...editData,
                                                                        contractor: { ...editData.contractor!, name: e.target.value }
                                                                    })}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>เลขประจำตัวประชาชน / เลขผู้เสียภาษี</Label>
                                                                <Input
                                                                    value={editData.contractor?.id_card || ''}
                                                                    onChange={(e) => setEditData({
                                                                        ...editData,
                                                                        contractor: { ...editData.contractor!, id_card: e.target.value }
                                                                    })}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>ที่อยู่</Label>
                                                            <Input
                                                                value={editData.contractor?.address || ''}
                                                                onChange={(e) => setEditData({
                                                                    ...editData,
                                                                    contractor: { ...editData.contractor!, address: e.target.value }
                                                                })}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2 mt-4 pt-4 border-t">
                                                        <Label>ขอบเขตงาน</Label>
                                                        <Textarea
                                                            value={editData.task || ''}
                                                            onChange={(e) => setEditData({ ...editData, task: e.target.value })}
                                                            className="min-h-[100px]"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>ราคา (บาท)</Label>
                                                            <Input
                                                                type="number"
                                                                value={editData.price || 0}
                                                                onChange={(e) => setEditData({ ...editData, price: Number(e.target.value) })}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>มัดจำ (บาท) - ใส่ 0 หากไม่มี</Label>
                                                            <Input
                                                                type="number"
                                                                value={editData.deposit || 0}
                                                                onChange={(e) => setEditData({ ...editData, deposit: Number(e.target.value) })}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>กำหนดเวลา</Label>
                                                            <Input
                                                                value={editData.deadline || ''}
                                                                onChange={(e) => setEditData({ ...editData, deadline: e.target.value })}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>เงื่อนไขการชำระเงิน</Label>
                                                            <Input
                                                                value={editData.paymentTerms || ''}
                                                                onChange={(e) => setEditData({ ...editData, paymentTerms: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-3 mt-4">
                                                    <Button variant="outline" onClick={() => setIsEditing(false)}>ยกเลิก</Button>
                                                    <Button onClick={handleEditSave} disabled={isSavingEdit}>
                                                        {isSavingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                                                    </Button>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    )}

                                    {(contract.employer.signature || contract.contractor.signature) && (
                                        <Button
                                            onClick={handleCreateRevision}
                                            variant="outline"
                                            disabled={isCreatingRevision}
                                            className="border-amber-200 text-amber-700 hover:bg-amber-50"
                                        >
                                            {isCreatingRevision ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                                            สร้างฉบับแก้ไข
                                        </Button>
                                    )}
                                </>
                            )}

                            <div className="flex gap-2">
                                <Button
                                    onClick={() => setShowFullView(true)}
                                    variant="outline"
                                    className="border-slate-200 text-slate-700"
                                >
                                    <Eye className="w-4 h-4 mr-2" />
                                    ดูสัญญาเต็มแผ่น
                                </Button>
                                <Button
                                    onClick={handleDownloadPDF}
                                    disabled={isGeneratingPDF}
                                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/10"
                                >
                                    {isGeneratingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                    {isGeneratingPDF ? 'กำลังสร้าง...' : 'PDF'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Main Contract Details - Spans 2 cols */}
                        {/* Main Contract Details - Spans 2 cols */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* PAGE 1: Header & Parties & Task */}
                            <Card className="border border-slate-200 shadow-xl rounded-sm bg-white mx-auto max-w-[210mm] w-full relative min-h-[297mm] flex flex-col overflow-hidden">
                                <div className="absolute inset-0 pointer-events-none border-[12px] border-white/50 z-10 mix-blend-overlay"></div>
                                <CardContent className="p-8 md:p-12 lg:p-20 space-y-8 font-serif leading-[1.8] text-slate-800 text-sm md:text-base relative z-20 flex-1">
                                    {!hideWatermark && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
                                            <img src="/images/logo-lawslane-transparent-color.png" alt="Lawslane Watermark" className="w-[80%] max-w-[400px]" />
                                        </div>
                                    )}

                                    <div className="text-center space-y-4 mb-8 relative z-10">
                                        <h2 className="text-3xl font-bold tracking-wide text-slate-900 mb-1">สัญญาจ้าง</h2>
                                        <p className="text-slate-500 font-sans">(ฉบับย่อ)</p>
                                    </div>

                                    <div className="flex flex-col items-end text-sm md:text-base mb-8 space-y-2">
                                        <div className="flex items-center">
                                            <span className="mr-2">ทำที่</span>
                                            <span className="border-b border-dotted border-slate-900 px-4 inline-block min-w-[200px] text-center font-medium">
                                                {contract.employer.address ? 'ตามที่อยู่ผู้ว่าจ้าง' : 'ข้อตกลงออนไลน์'}
                                            </span>
                                        </div>
                                        <div className="flex items-center pb-4">
                                            <span className="mr-2">วันที่</span>
                                            <span className="border-b border-dotted border-slate-900 px-4 inline-block min-w-[200px] text-center font-medium">
                                                {formatDate(contract.createdAt).split(' ').slice(0, 3).join(' ')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-6 text-slate-900 text-[15px] md:text-[16px]">
                                        <p className="indent-12 text-justify">
                                            สัญญาฉบับนี้ทำขึ้นระหว่าง <strong>{contract.employer.name || '…………………………………………'}</strong>
                                            {contract.employer.id_card ? (
                                                <> บัตรประจำตัวประชาชนเลขที่ <strong>{contract.employer.id_card}</strong></>
                                            ) : (
                                                <> บัตรประจำตัวประชาชนเลขที่ <span className="text-slate-400">...................................................</span></>
                                            )}
                                            {contract.employer.address ? (
                                                <> ตั้งอยู่หรืออาศัยอยู่เลขที่ <strong>{contract.employer.address}</strong></>
                                            ) : (
                                                <> ตั้งอยู่หรืออาศัยอยู่เลขที่ <span className="text-slate-400">.................................................................................</span></>
                                            )}
                                            ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>"ผู้ว่าจ้าง"</strong> ฝ่ายหนึ่ง
                                        </p>

                                        <p className="indent-12 text-justify">
                                            กับ <strong>{contract.contractor.name || '…………………………………………'}</strong>
                                            {contract.contractor.id_card ? (
                                                <> บัตรประจำตัวประชาชนเลขที่ <strong>{contract.contractor.id_card}</strong></>
                                            ) : (
                                                <> บัตรประจำตัวประชาชนเลขที่ <span className="text-slate-400">...................................................</span></>
                                            )}
                                            {contract.contractor.address ? (
                                                <> ตั้งอยู่หรืออาศัยอยู่เลขที่ <strong>{contract.contractor.address}</strong></>
                                            ) : (
                                                <> ตั้งอยู่หรืออาศัยอยู่เลขที่ <span className="text-slate-400">.................................................................................</span></>
                                            )}
                                            ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>"ผู้รับจ้าง"</strong> อีกฝ่ายหนึ่ง
                                        </p>

                                        <p className="indent-12">
                                            คู่สัญญาทั้งสองฝ่ายตกลงทำสัญญากันดังมีข้อความต่อไปนี้:
                                        </p>

                                        <div className="space-y-6 pt-2 pl-2 md:pl-6 leading-[1.9]">
                                            <div>
                                                <p>
                                                    <strong>ข้อ 1. ขอบเขตของงาน</strong><br />
                                                    ผู้ว่าจ้างตกลงจ้างและผู้รับจ้างตกลงรับจ้างทำงาน ดังต่อไปนี้:
                                                </p>
                                                <div className="mt-2 pl-6 py-2 border-l-2 border-slate-200 text-slate-800 whitespace-pre-line bg-slate-50/50 rounded-r text-sm">
                                                    {contract.task}
                                                </div>
                                            </div>

                                            <div>
                                                <p>
                                                    <strong>ข้อ 2. ค่าจ้างและเงื่อนไขการชำระเงิน</strong><br />
                                                    ผู้ว่าจ้างตกลงชำระค่าจ้างให้แก่ผู้รับจ้างเป็นจำนวนเงิน <strong>{contract.price.toLocaleString()}</strong> บาท
                                                    <span className="text-[13px] text-slate-600 ml-1">(ยังไม่รวมภาษีมูลค่าเพิ่ม)</span><br />
                                                    {contract.deposit && contract.deposit > 0 ? (
                                                        <span className="block mt-1 pl-6">
                                                            - มัดจำ: <strong>{contract.deposit.toLocaleString()}</strong> บาท
                                                        </span>
                                                    ) : null}
                                                    <span className="block mt-1 pl-6">
                                                        - เงื่อนไขการชำระเงิน: {contract.paymentTerms || 'ตามตกลงกัน'}
                                                    </span>
                                                </p>
                                            </div>

                                            <div>
                                                <p>
                                                    <strong>ข้อ 3. กำหนดเวลาและสถานที่ส่งมอบงาน</strong><br />
                                                    ผู้รับจ้างตกลงจะทำงานที่รับจ้างให้แล้วเสร็จและส่งมอบงานให้แก่ผู้ว่าจ้างภายใน <strong>{contract.deadline}</strong>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                                <div className="p-4 bg-slate-50/50 text-center text-[10px] text-slate-400 font-sans border-t border-slate-100">
                                    Page 1 of 2
                                </div>
                            </Card>

                            {/* PAGE 2: Terms, Attachments, Signatures */}
                            <Card className="border border-slate-200 shadow-xl rounded-sm bg-white mx-auto max-w-[210mm] w-full relative min-h-[297mm] flex flex-col overflow-hidden">
                                <div className="absolute inset-0 pointer-events-none border-[12px] border-white/50 z-10 mix-blend-overlay"></div>
                                <CardContent className="p-8 md:p-12 lg:p-20 space-y-8 font-serif leading-[1.8] text-slate-800 text-sm md:text-base relative z-20 flex-1">
                                    {!hideWatermark && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
                                            <img src="/images/logo-lawslane-transparent-color.png" alt="Lawslane Watermark" className="w-[80%] max-w-[400px]" />
                                        </div>
                                    )}

                                    <div className="space-y-6 text-slate-900 text-[15px] md:text-[16px]">
                                        <div className="space-y-6 leading-[1.9]">
                                            <p>
                                                <strong>ข้อ 4. การบอกเลิกสัญญา</strong><br />
                                                หากผู้รับจ้างไม่สามารถทำงานให้แล้วเสร็จตามกำหนด หรือเจตนาทิ้งงาน ผู้ว่าจ้างมีสิทธิบอกเลิกสัญญาและเรียกร้องค่าเสียหายได้ทันที
                                            </p>
                                        </div>

                                        <p className="indent-12 mt-12 mb-8 text-justify">
                                            สัญญานี้เป็นการสรุปข้อตกลงเบื้องต้นจากการเจรจาผ่านทางแชท คู่สัญญาได้อ่านและเข้าใจข้อความโดยตลอดแล้ว จึงได้ลงลายมือชื่อผ่านระบบอิเล็กทรอนิกส์ไว้เป็นสำคัญ
                                        </p>

                                        {/* Attachments Section */}
                                        <div className="mt-12 pt-8 border-t border-slate-200">
                                            <div className="flex items-center justify-between mb-6">
                                                <h3 className="font-bold text-slate-900 flex items-center text-lg">
                                                    <Paperclip className="w-5 h-5 mr-2 text-blue-600" />
                                                    เอกสารแนบท้ายสัญญา
                                                </h3>
                                            </div>

                                            {contract.attachments && contract.attachments.length > 0 ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                                                    {contract.attachments.map((file, idx) => {
                                                        const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
                                                        
                                                        return (
                                                            <div key={idx} className="relative group rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all">
                                                                {isImage ? (
                                                                    <div className="aspect-video w-full bg-slate-100 relative overflow-hidden">
                                                                        <img 
                                                                            src={file.url} 
                                                                            alt={file.name} 
                                                                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                                        />
                                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-full text-slate-900 shadow-xl transform scale-75 group-hover:scale-100 transition-transform">
                                                                                <Eye className="w-5 h-5" />
                                                                            </a>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="aspect-video w-full bg-slate-50 flex items-center justify-center text-slate-400">
                                                                        <FileText className="w-10 h-10" />
                                                                    </div>
                                                                )}
                                                                
                                                                <div className="p-3 flex items-center justify-between bg-white border-t border-slate-100">
                                                                    <div className="overflow-hidden">
                                                                        <p className="text-xs font-medium text-slate-700 truncate">{file.name}</p>
                                                                        <p className="text-[10px] text-slate-400 uppercase">{file.type?.split('/')[1] || 'FILE'}</p>
                                                                    </div>
                                                                    
                                                                    <div className="flex items-center gap-1">
                                                                        <a 
                                                                            href={file.url} 
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer"
                                                                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                                                                        >
                                                                            <Download className="w-3.5 h-3.5" />
                                                                        </a>
                                                                        
                                                                        {user?.uid === contract.ownerId && contract.status !== 'signed' && (
                                                                            <button
                                                                                onClick={() => handleDeleteAttachment(idx)}
                                                                                className="p-1.5 text-red-400 hover:bg-red-50 rounded"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-xl mb-6">
                                                    <Paperclip className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                                    <p className="text-sm text-slate-400">ไม่มีเอกสารแนบเพิ่มเติม</p>
                                                </div>
                                            )}

                                            {/* Upload Input - Only Owner before signing */}
                                            {user?.uid === contract.ownerId && contract.status !== 'signed' && (
                                                <div className="mt-4">
                                                    {isSubLoading ? (
                                                        <div className="h-10 bg-slate-100 animate-pulse rounded-md" />
                                                    ) : isActive ? (
                                                        <div className="relative">
                                                            <Input
                                                                type="file"
                                                                onChange={handleFileUpload}
                                                                disabled={isUploading}
                                                                className="hidden"
                                                                id="file-upload"
                                                            />
                                                            <Label
                                                                htmlFor="file-upload"
                                                                className={`flex items-center justify-center w-full sm:w-auto px-4 py-2 border border-dashed rounded-md cursor-pointer text-sm font-medium transition-colors ${isUploading
                                                                    ? 'bg-slate-50 border-slate-300 text-slate-400 cursor-not-allowed'
                                                                    : 'border-blue-300 text-blue-600 hover:bg-blue-50'
                                                                    }`}
                                                            >
                                                                {isUploading ? (
                                                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังอัปโหลด...</>
                                                                ) : (
                                                                    <><Plus className="w-4 h-4 mr-2" /> เพิ่มเอกสารแนบ</>
                                                                )}
                                                            </Label>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm border border-amber-200">
                                                            <div className="flex items-center font-medium">
                                                                <Lock className="w-4 h-4 mr-2 text-amber-600" />
                                                                อัปเกรดแพ็กเกจ
                                                            </div>
                                                            <p className="text-amber-700">เพื่อปลดล็อกฟีเจอร์อัปโหลดเอกสารแนบ (เช่น ใบเสนอราคา, แบบร่างงาน)</p>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="sm:ml-auto border-amber-300 hover:bg-amber-100"
                                                                onClick={() => router.push('/th/pricing')}
                                                            >
                                                                ดูแพ็กเกจ
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex justify-around items-end pt-12 text-sm mt-16 border-t border-slate-100">
                                            {/* Employer Signature Area */}
                                            <div className="text-center space-y-3 flex-1 px-4">
                                                <div className="h-24 flex flex-col items-center justify-end">
                                                    {contract.employer.signature ? (
                                                        <div className="relative group">
                                                            <img 
                                                                src={contract.employer.signature} 
                                                                alt="Employer Signature" 
                                                                className="h-20 object-contain mx-auto" 
                                                            />
                                                            <div className="text-[10px] text-emerald-600 font-sans opacity-0 group-hover:opacity-100 transition-opacity">
                                                                Digital ID: {contract.employer.signedAt?.toString().slice(-8)}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="w-full pb-2">
                                                            {/* Only show button in Web View, not PDF */}
                                                            {!isGeneratingPDF ? (
                                                                <Button 
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setSigningRole('employer');
                                                                        setIsDialogOpen(true);
                                                                    }}
                                                                    className="w-full max-w-[160px] border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all py-6 h-auto"
                                                                >
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <PenTool className="w-4 h-4" />
                                                                        <span>คลิกเพื่อเซ็นชื่อ</span>
                                                                    </div>
                                                                </Button>
                                                            ) : (
                                                                <div className="w-40 border-b border-dotted border-slate-900 mx-auto h-8"></div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="font-medium text-slate-900">ผู้ว่าจ้าง</p>
                                                    <p className="text-slate-500">( {contract.employer.name || '…………………………………………'} )</p>
                                                </div>
                                            </div>

                                            {/* Contractor Signature Area */}
                                            <div className="text-center space-y-3 flex-1 px-4">
                                                <div className="h-24 flex flex-col items-center justify-end">
                                                    {contract.contractor.signature ? (
                                                        <div className="relative group">
                                                            <img 
                                                                src={contract.contractor.signature} 
                                                                alt="Contractor Signature" 
                                                                className="h-20 object-contain mx-auto" 
                                                            />
                                                            <div className="text-[10px] text-emerald-600 font-sans opacity-0 group-hover:opacity-100 transition-opacity">
                                                                Digital ID: {contract.contractor.signedAt?.toString().slice(-8)}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="w-full pb-2">
                                                            {/* Only show button in Web View, not PDF */}
                                                            {!isGeneratingPDF ? (
                                                                <Button 
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setSigningRole('contractor');
                                                                        setIsDialogOpen(true);
                                                                    }}
                                                                    className="w-full max-w-[160px] border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all py-6 h-auto"
                                                                >
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <PenTool className="w-4 h-4" />
                                                                        <span>คลิกเพื่อเซ็นชื่อ</span>
                                                                    </div>
                                                                </Button>
                                                            ) : (
                                                                <div className="w-40 border-b border-dotted border-slate-900 mx-auto h-8"></div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="font-medium text-slate-900">ผู้รับจ้าง</p>
                                                    <p className="text-slate-500">( {contract.contractor.name || '…………………………………………'} )</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                                <div className="p-4 bg-slate-50/50 text-center text-[10px] text-slate-400 font-sans border-t border-slate-100">
                                    Page 2 of 2
                                </div>
                            </Card>
                        </div>

                        {/* Right Sidebar - Party Info & Actions */}
                        <div className="space-y-6">
                            {/* Employer Card */}
                            <Card className="border border-slate-200 shadow-sm overflow-hidden">
                                <CardHeader className="bg-slate-50/50 pb-3">
                                    <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">ผู้ว่าจ้าง (Employer)</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                            <User className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{contract.employer.name || 'ไม่ได้ระบุชื่อ'}</p>
                                            <p className="text-xs text-slate-400">{contract.employer.email || 'ไม่ระบุอีเมล'}</p>
                                        </div>
                                    </div>
                                    
                                    {contract.employer.signature && (
                                        <div className="pt-2 flex items-center gap-2 text-emerald-600 text-sm font-medium">
                                            <CheckCircle className="w-4 h-4" />
                                            ลงนามเรียบร้อยแล้ว
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Contractor Card */}
                            <Card className="border border-slate-200 shadow-sm overflow-hidden">
                                <CardHeader className="bg-slate-50/50 pb-3">
                                    <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">ผู้รับจ้าง (Contractor)</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                            <User className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{contract.contractor.name || 'ไม่ได้ระบุชื่อ'}</p>
                                            <p className="text-xs text-slate-400">{contract.contractor.email || 'ไม่ระบุอีเมล'}</p>
                                        </div>
                                    </div>

                                    {contract.contractor.signature && (
                                        <div className="pt-2 flex items-center gap-2 text-emerald-600 text-sm font-medium">
                                            <CheckCircle className="w-4 h-4" />
                                            ลงนามเรียบร้อยแล้ว
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Help/Support Card */}
                            <Card className="bg-blue-600 text-white border-none shadow-lg shadow-blue-200">
                                <CardContent className="p-6 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="w-5 h-5 text-blue-200" />
                                        <h3 className="font-bold text-lg">ปลอดภัยและถูกกฎหมาย</h3>
                                    </div>
                                    <p className="text-blue-100 text-sm leading-relaxed">
                                        สัญญานี้มีผลผูกพันทางกฎหมายตาม พ.ร.บ. ว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ ข้อมูลทั้งหมดถูกจัดเก็บอย่างปลอดภัย
                                    </p>
                                    <Button 
                                        variant="link" 
                                        className="text-blue-200 p-0 h-auto font-medium hover:text-white"
                                        onClick={() => setShowESignInfo(true)}
                                    >
                                        เรียนรู้เพิ่มเติมเกี่ยวกับ e-Signature
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </FadeIn>
            </div>

            {/* Full Page View Modal */}
            <Dialog open={showFullView} onOpenChange={setShowFullView}>
                <DialogContent className="max-w-[90vw] md:max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-none bg-slate-900/50 backdrop-blur-md">
                    <DialogTitle className="sr-only">ดูสัญญาเต็มแผ่น</DialogTitle>
                    {contract && (
                        <>
                            <div className="sticky top-0 right-0 z-[100] flex justify-end p-4">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setShowFullView(false)}
                                    className="text-white hover:bg-white/20 rounded-full"
                                >
                                    <X className="w-6 h-6" />
                                </Button>
                            </div>
                            <div className="flex flex-col items-center gap-12 p-4 md:p-12 pb-24">
                                {/* PAGE 1 */}
                                <Card className="bg-white shadow-2xl rounded-sm w-full max-w-[210mm] relative overflow-hidden font-serif leading-[1.8] min-h-[297mm] h-auto flex flex-col">
                                    {!hideWatermark && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
                                            <img src="/images/logo-lawslane-transparent-color.png" alt="Lawslane Watermark" className="w-[80%]" />
                                        </div>
                                    )}
                                    <CardContent className="p-8 md:p-20 space-y-8 text-slate-800 text-[15px] relative z-10 flex-1">
                                        <div className="text-center space-y-2 mb-10">
                                            <h1 className="text-3xl font-bold text-slate-900">สัญญาจ้าง</h1>
                                            <p className="text-slate-500 font-sans">(ฉบับย่อ)</p>
                                        </div>

                                        <div className="text-right mb-10">
                                            วันที่: {formatDate(contract.createdAt).split(' ').slice(0, 3).join(' ')}
                                        </div>

                                        <div className="space-y-6">
                                            <p className="indent-12 text-justify">
                                                สัญญาฉบับนี้ทำขึ้นระหว่าง <strong>{contract.employer.name || '.....................'}</strong>
                                                บัตรประจำตัวประชาชนเลขที่ <strong>{contract.employer.id_card || '.....................'}</strong>
                                                ตั้งอยู่เลขที่ <strong>{contract.employer.address || '.....................'}</strong>
                                                ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>"ผู้ว่าจ้าง"</strong> ฝ่ายหนึ่ง
                                            </p>

                                            <p className="indent-12 text-justify">
                                                กับ <strong>{contract.contractor.name || '.....................'}</strong>
                                                บัตรประจำตัวประชาชนเลขที่ <strong>{contract.contractor.id_card || '.....................'}</strong>
                                                ตั้งอยู่เลขที่ <strong>{contract.contractor.address || '.....................'}</strong>
                                                ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>"ผู้รับจ้าง"</strong> อีกฝ่ายหนึ่ง
                                            </p>

                                            <p className="indent-12">คู่สัญญาทั้งสองฝ่ายตกลงทำสัญญากันดังมีข้อความต่อไปนี้:</p>

                                            <div className="space-y-6 pt-2 pl-6">
                                                <div>
                                                    <p><strong>ข้อ 1. ขอบเขตของงาน</strong></p>
                                                    <p className="pl-6 border-l-2 border-slate-100 text-slate-600 italic py-1">{contract.task}</p>
                                                </div>

                                                <div>
                                                    <p><strong>ข้อ 2. ค่าจ้างและเงื่อนไขการชำระเงิน</strong></p>
                                                    <p className="pl-6">
                                                        ผู้ว่าจ้างตกลงชำระค่าจ้างทั้งสิ้น <strong>{contract.price.toLocaleString()}</strong> บาท
                                                        {contract.deposit ? ` (มัดจำแล้ว ${contract.deposit.toLocaleString()} บาท)` : ''}
                                                        <br />เงื่อนไขการชำระเงิน: {contract.paymentTerms || 'ตามตกลงกัน'}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p><strong>ข้อ 3. กำหนดเวลาและสถานที่ส่งมอบงาน</strong></p>
                                                    <p className="pl-6">ส่งมอบงานภายใน <strong>{contract.deadline}</strong></p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                    <div className="p-4 bg-slate-50 text-center text-[10px] text-slate-400 font-sans">Page 1 of 2</div>
                                </Card>

                                {/* PAGE 2 */}
                                <Card className="bg-white shadow-2xl rounded-sm w-full max-w-[210mm] relative overflow-hidden font-serif leading-[1.8] min-h-[297mm] h-auto flex flex-col">
                                    {!hideWatermark && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
                                            <img src="/images/logo-lawslane-transparent-color.png" alt="Lawslane Watermark" className="w-[80%]" />
                                        </div>
                                    )}
                                    <CardContent className="p-8 md:p-20 space-y-8 text-slate-800 text-[15px] relative z-10 flex-1">
                                        <div className="space-y-6">
                                            <div className="space-y-2 pl-6">
                                                <p className="font-bold">ข้อ 4. การบอกเลิกสัญญา</p>
                                                <p>หากผู้รับจ้างไม่สามารถทำงานให้แล้วเสร็จตามกำหนด หรือเจตนาทิ้งงาน ผู้ว่าจ้างมีสิทธิบอกเลิกสัญญาและเรียกร้องค่าเสียหายได้ทันที</p>
                                            </div>

                                            <p className="indent-12 text-justify pt-8">
                                                สัญญานี้เป็นการสรุปข้อตกลงเบื้องต้นจากการเจรจาผ่านทางแชท คู่สัญญาได้อ่านและเข้าใจข้อความโดยตลอดแล้ว จึงได้ลงลายมือชื่อผ่านระบบอิเล็กทรอนิกส์ไว้เป็นสำคัญ
                                            </p>

                                            {/* Attachments Section */}
                                            {contract.attachments && contract.attachments.length > 0 && (
                                                <div className="mt-12 pt-8 border-t border-slate-100">
                                                    <p className="font-bold mb-4">เอกสารแนบท้ายสัญญา:</p>
                                                    <ul className="list-disc pl-8 space-y-2">
                                                        {contract.attachments.map((file, idx) => (
                                                            <li key={idx} className="text-sm">{file.name}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            <div className="flex justify-around items-end pt-12 text-sm mt-16 border-t border-slate-100">
                                                {/* Employer Signature Area */}
                                                <div className="text-center space-y-3 flex-1 px-4">
                                                    <div className="h-24 flex flex-col items-center justify-end">
                                                        {contract.employer.signature ? (
                                                            <div className="relative group">
                                                                <img src={contract.employer.signature} alt="Employer Signature" className="h-20 object-contain mx-auto" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-full pb-2">
                                                                {!isGeneratingPDF ? (
                                                                    <Button 
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSigningRole('employer');
                                                                            setIsDialogOpen(true);
                                                                        }}
                                                                        className="w-full max-w-[160px] border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all py-6 h-auto"
                                                                    >
                                                                        <div className="flex flex-col items-center gap-1 font-sans">
                                                                            <PenTool className="w-4 h-4" />
                                                                            <span>คลิกเพื่อเซ็นชื่อ</span>
                                                                        </div>
                                                                    </Button>
                                                                ) : (
                                                                    <div className="w-40 border-b border-dotted border-slate-900 mx-auto h-8"></div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="font-medium text-slate-900">ผู้ว่าจ้าง</p>
                                                        <p className="text-slate-500">( {contract.employer.name || '…………………………………………'} )</p>
                                                    </div>
                                                </div>

                                                {/* Contractor Signature Area */}
                                                <div className="text-center space-y-3 flex-1 px-4">
                                                    <div className="h-24 flex flex-col items-center justify-end">
                                                        {contract.contractor.signature ? (
                                                            <div className="relative group">
                                                                <img src={contract.contractor.signature} alt="Contractor Signature" className="h-20 object-contain mx-auto" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-full pb-2">
                                                                {!isGeneratingPDF ? (
                                                                    <Button 
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSigningRole('contractor');
                                                                            setIsDialogOpen(true);
                                                                        }}
                                                                        className="w-full max-w-[160px] border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all py-6 h-auto"
                                                                    >
                                                                        <div className="flex flex-col items-center gap-1 font-sans">
                                                                            <PenTool className="w-4 h-4" />
                                                                            <span>คลิกเพื่อเซ็นชื่อ</span>
                                                                        </div>
                                                                    </Button>
                                                                ) : (
                                                                    <div className="w-40 border-b border-dotted border-slate-900 mx-auto h-8"></div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="font-medium text-slate-900">ผู้รับจ้าง</p>
                                                        <p className="text-slate-500">( {contract.contractor.name || '…………………………………………'} )</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                    <div className="p-4 bg-slate-50 text-center text-[10px] text-slate-400 font-sans">Page 2 of 2</div>
                                </Card>
                            </div>

                            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110]">
                                <Button
                                    onClick={handleDownloadPDF}
                                    disabled={isGeneratingPDF}
                                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 shadow-2xl h-12"
                                >
                                    {isGeneratingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                    ดาวน์โหลดเป็น PDF
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Global Signing Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md bg-white border-none shadow-2xl rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <PenTool className="w-5 h-5 text-blue-600" />
                            ลงลายมือชื่อ ({signingRole === 'employer' ? 'ผู้ว่าจ้าง' : 'ผู้รับจ้าง'})
                        </DialogTitle>
                        <DialogDescription className="text-slate-500">
                            กรุณาเซ็นชื่อลงในช่องว่างด้านล่างเพื่อยืนยันสัญญาฉบับนี้
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <SignaturePad onSave={handleSign} />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Confirmation Dialog for Signing */}
            <AlertDialog open={showConfirmSign} onOpenChange={setShowConfirmSign}>
                <AlertDialogContent className="bg-white border-none shadow-2xl rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold text-slate-900">ยืนยันการเซ็นชื่อ</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-600 text-base">
                            ลายเซ็นนี้จะไม่สามารถแก้ไขได้อีกหลังจากกดยืนยัน คุณต้องการดำเนินการต่อใช่หรือไม่?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50">ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleConfirmSign}
                            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 shadow-lg shadow-blue-200"
                        >
                            ยืนยันและบันทึก
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* e-Signature Information Dialog */}
            <Dialog open={showESignInfo} onOpenChange={setShowESignInfo}>
                <DialogContent className="sm:max-w-2xl bg-white border-none shadow-2xl rounded-2xl overflow-hidden p-0">
                    <div className="bg-blue-600 p-8 text-white">
                        <div className="flex items-center gap-3 mb-2">
                            <ShieldCheck className="w-8 h-8 text-blue-200" />
                            <DialogTitle className="text-2xl font-bold">e-Signature ของเราปลอดภัยอย่างไร?</DialogTitle>
                        </div>
                        <p className="text-blue-100 opacity-90">ทำความเข้าใจความถูกต้องทางกฎหมายและความปลอดภัยในระบบ Lawslane Capdeal</p>
                    </div>
                    
                    <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                        <section className="space-y-3">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                ความถูกต้องทางกฎหมาย
                            </h3>
                            <p className="text-slate-600 leading-relaxed text-justify indent-8">
                                ลายมือชื่ออิเล็กทรอนิกส์ในระบบ Capdeal มีผลผูกพันทางกฎหมายตาม <strong>พ.ร.บ. ว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ พ.ศ. 2544</strong> (และฉบับแก้ไขเพิ่มเติม) ซึ่งกำหนดให้ข้อมูลที่สร้างขึ้นในรูปแบบอิเล็กทรอนิกส์สามารถใช้เป็นหลักฐานในศาลได้เทียบเท่ากับเอกสารกระดาษ
                            </p>
                        </section>

                        <section className="space-y-3">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <Lock className="w-5 h-5 text-blue-600" />
                                มาตรฐานความปลอดภัย
                            </h3>
                            <ul className="space-y-3">
                                <li className="flex gap-3 text-slate-600">
                                    <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">1</div>
                                    <p><strong>การระบุตัวตน (Identity Verification):</strong> ผู้ลงนามต้องผ่านการยืนยันตัวตนผ่านระบบบัญชีผู้ใช้ที่ปลอดภัย</p>
                                </li>
                                <li className="flex gap-3 text-slate-600">
                                    <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">2</div>
                                    <p><strong>บันทึกประวัติ (Audit Trail):</strong> ระบบบันทึกวันเวลา (Timestamp) และข้อมูลทางเทคนิคที่เกี่ยวข้องในขณะที่มีการลงนาม</p>
                                </li>
                                <li className="flex gap-3 text-slate-600">
                                    <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">3</div>
                                    <p><strong>ความครบถ้วนของข้อมูล (Integrity):</strong> เมื่อมีการลงนามแล้ว เนื้อหาสัญญาจะไม่สามารถถูกแก้ไขฝ่ายเดียวได้โดยไม่มีการแจ้งเตือนหรือการสร้างฉบับแก้ไขใหม่ (Revision)</p>
                                </li>
                            </ul>
                        </section>

                        <section className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <p className="text-sm text-slate-500 italic text-center">
                                "เรามุ่งมั่นสร้างมาตรฐานใหม่ในการทำสัญญา เพื่อให้ทุกการว่าจ้างของคุณปลอดภัยและตรวจสอบได้จริง"
                            </p>
                        </section>
                    </div>
                    
                    <div className="p-6 border-t bg-slate-50 flex justify-end">
                        <Button onClick={() => setShowESignInfo(false)} className="bg-slate-900 text-white rounded-xl px-6">
                            เข้าใจแล้ว
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
