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
import { SignaturePad } from '@/components/ui/signature-pad';
import { FileSignature, AlertTriangle, Shield, CheckCircle, Edit, Plus, Calendar, User, Download, Link as LinkIcon, Share2, Loader2, Paperclip, Lock, FileText, Trash2 } from 'lucide-react';
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
    const { isActive, isLoading: isSubLoading } = useSubscription();

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
                task: `${contract.task}\n\n(อ้างอิงและแก้ไขจากสัญญาฉบับเดิม: ${contract.id})`,
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
        if (!signingRole || !contract) return;

        try {
            await contractService.signContract(id, signingRole, signatureDataUrl);
            setIsDialogOpen(false);
        } catch (error) {
            console.error('Error signing contract:', error);
            // Could add toast error here
        }
    };

    const handleDownloadPDF = async () => {
        if (!contract) return;
        setIsGeneratingPDF(true);
        try {
            await generateContractPDF(contract as any);
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
            <div className="container mx-auto max-w-4xl">
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
                            <p className="text-slate-500">Contract ID: <span className="font-mono text-xs text-slate-400">{contract.id}</span></p>
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

                            {contract.status === 'signed' && (
                                <Button
                                    onClick={handleDownloadPDF}
                                    disabled={isGeneratingPDF}
                                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/10"
                                >
                                    {isGeneratingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                    {isGeneratingPDF ? 'กำลังสร้าง...' : 'PDF'}
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Main Contract Details - Spans 2 cols */}
                        <div className="md:col-span-2 space-y-6">
                            <Card className="border border-slate-200 shadow-xl rounded-sm overflow-hidden bg-white mx-auto max-w-[210mm] relative">
                                {/* Subtle page texture/border */}
                                <div className="absolute inset-0 pointer-events-none border-[12px] border-white/50 z-10 mix-blend-overlay"></div>

                                <CardContent className="p-10 md:p-16 space-y-8 font-serif leading-[1.8] text-slate-800 text-sm md:text-base relative z-20">
                                    <div className="text-center space-y-4 mb-8">
                                        {/* Optional: Add a Thai Garuda emblem placeholder here if needed, or just a nice separator */}
                                        <h2 className="text-3xl font-bold tracking-wide text-slate-900 mb-2">สัญญาจ้างทำของ</h2>
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

                                            <p>
                                                <strong>ข้อ 3. กำหนดเวลาและสถานที่ส่งมอบงาน</strong><br />
                                                ผู้รับจ้างตกลงจะทำงานที่รับจ้างให้แล้วเสร็จและส่งมอบงานให้แก่ผู้ว่าจ้างภายใน <strong>{contract.deadline}</strong>
                                            </p>


                                        </div>

                                        <p className="indent-12 mt-12 mb-8 text-justify">
                                            สัญญานี้เป็นการสรุปข้อตกลงเบื้องต้นจากการเจรจาผ่านทางแชท คู่สัญญาได้อ่านและเข้าใจข้อความโดยตลอดแล้ว จึงได้ลงลายมือชื่อผ่านระบบอิเล็กทรอนิกส์ไว้เป็นสำคัญ
                                        </p>

                                        {/* Attachments Section */}
                                        <div className="mt-12 pt-6 border-t border-slate-100">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="font-semibold text-slate-800 flex items-center">
                                                    <Paperclip className="w-4 h-4 mr-2" />
                                                    เอกสารแนบสัญญา
                                                </h3>
                                            </div>

                                            {contract.attachments && contract.attachments.length > 0 ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                                    {contract.attachments.map((file, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-md group">
                                                            <a
                                                                href={file.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center text-blue-600 hover:underline overflow-hidden flex-1"
                                                            >
                                                                <FileText className="w-4 h-4 mr-2 shrink-0" />
                                                                <span className="truncate text-sm">{file.name}</span>
                                                            </a>

                                                            {/* Only owner can delete before contract is signed */}
                                                            {user?.uid === contract.ownerId && contract.status !== 'signed' && (
                                                                <button
                                                                    onClick={() => handleDeleteAttachment(idx)}
                                                                    className="text-red-400 hover:text-red-600 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-slate-500 italic mb-4">ไม่มีเอกสารแนบ</p>
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
                                            <div className="text-center space-y-2">
                                                <p>ลงชื่อ <span className="inline-block w-40 border-b border-dotted border-slate-900">{contract.employer.signature ? ' ' : ''}</span> ผู้ว่าจ้าง</p>
                                                <p>( {contract.employer.name || '…………………………………………'} )</p>
                                            </div>
                                            <div className="text-center space-y-2">
                                                <p>ลงชื่อ <span className="inline-block w-40 border-b border-dotted border-slate-900">{contract.contractor.signature ? ' ' : ''}</span> ผู้รับจ้าง</p>
                                                <p>( {contract.contractor.name || '…………………………………………'} )</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Signatures Panel - Side Col */}
                        <div className="space-y-6">
                            {/* Employer Card */}
                            <Card className={`border-0 shadow-lg rounded-2xl ${contract.employer.signature ? 'bg-green-50' : 'bg-white'}`}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wide">ผู้ว่าจ้าง (Employer)</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                                            <User className="w-5 h-5 text-slate-500" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{contract.employer.name}</p>
                                            <p className="text-xs text-slate-500">{contract.employer.email || 'ไม่ระบุอีเมล'}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        {contract.employer.signature ? (
                                            <div className="space-y-2 text-center">
                                                <div className="bg-white p-2 rounded-lg border border-green-200">
                                                    <img src={contract.employer.signature} alt="Employer Signature" className="h-16 mx-auto" />
                                                </div>
                                                <p className="text-xs text-green-600 flex items-center justify-center gap-1">
                                                    <CheckCircle className="w-3 h-3" /> เซ็นแล้วเมื่อ {formatDate(contract.employer.signedAt)}
                                                </p>
                                            </div>
                                        ) : (
                                            <Dialog open={isDialogOpen && signingRole === 'employer'} onOpenChange={setIsDialogOpen}>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        onClick={() => { setSigningRole('employer'); setIsDialogOpen(true); }}
                                                        className="w-full bg-slate-800 hover:bg-slate-900 text-white"
                                                    >
                                                        เซ็นชื่อในฐานะผู้ว่าจ้าง
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-md">
                                                    <DialogHeader>
                                                        <DialogTitle>ลงลายมือชื่อ (ผู้ว่าจ้าง)</DialogTitle>
                                                        <DialogDescription>
                                                            กรุณาเซ็นชื่อลงในช่องว่างด้านล่างเพื่อยืนยันสัญญา
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <SignaturePad onSave={handleSign} />
                                                </DialogContent>
                                            </Dialog>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Contractor Card */}
                            <Card className={`border-0 shadow-lg rounded-2xl ${contract.contractor.signature ? 'bg-green-50' : 'bg-white'}`}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wide">ผู้รับจ้าง (Contractor)</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                                            <User className="w-5 h-5 text-slate-500" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{contract.contractor.name}</p>
                                            <p className="text-xs text-slate-500">{contract.contractor.email || 'ไม่ระบุอีเมล'}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        {contract.contractor.signature ? (
                                            <div className="space-y-2 text-center">
                                                <div className="bg-white p-2 rounded-lg border border-green-200">
                                                    <img src={contract.contractor.signature} alt="Contractor Signature" className="h-16 mx-auto" />
                                                </div>
                                                <p className="text-xs text-green-600 flex items-center justify-center gap-1">
                                                    <CheckCircle className="w-3 h-3" /> เซ็นแล้วเมื่อ {formatDate(contract.contractor.signedAt)}
                                                </p>
                                            </div>
                                        ) : (
                                            <Dialog open={isDialogOpen && signingRole === 'contractor'} onOpenChange={setIsDialogOpen}>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        onClick={() => { setSigningRole('contractor'); setIsDialogOpen(true); }}
                                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                                    >
                                                        เซ็นชื่อในฐานะผู้รับจ้าง
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-md">
                                                    <DialogHeader>
                                                        <DialogTitle>ลงลายมือชื่อ (ผู้รับจ้าง)</DialogTitle>
                                                        <DialogDescription>
                                                            กรุณาเซ็นชื่อลงในช่องว่างด้านล่างเพื่อยืนยันสัญญา
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <SignaturePad onSave={handleSign} />
                                                </DialogContent>
                                            </Dialog>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </FadeIn>
            </div>
        </div>
    );
}
