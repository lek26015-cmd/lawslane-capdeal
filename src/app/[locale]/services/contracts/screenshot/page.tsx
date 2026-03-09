'use client';

import { useParams, useRouter } from 'next/navigation';
import { Link } from '@/navigation';
import { contractService } from '@/services/contractService';
import { useUser } from '@/firebase/provider';
import { TurnstileWidget } from '@/components/turnstile-widget';
import { useSubscription } from '@/hooks/useSubscription';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Loader2,
    AlertTriangle,
    CheckCircle,
    Plus,
    Shield,
    FileSignature,
    ArrowRight,
    Sparkles,
    X,
    Share2,
    Link as LinkIcon,
    LogIn,
    ShieldCheck,
    HelpCircle,
    Copy,
    ClipboardCheck
} from 'lucide-react';



import { useToast } from '@/hooks/use-toast';
import { FadeIn } from '@/components/fade-in';
import { generateContractPDF } from '@/lib/contract-pdf';

interface ContractData {
    employer: string;
    employerId: string;
    employerAddress: string;
    contractor: string;
    contractorId: string;
    contractorAddress: string;
    task: string;
    price: number;
    deposit: number;
    deadline: string;
    paymentTerms: string;
    missingInfo: string[];
    riskyTerms: string[];
}



export default function ScreenshotToContractPage() {
    const { locale } = useParams();
    const { user } = useUser();
    const [images, setImages] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [contractData, setContractData] = useState<ContractData | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
    const [createdContractId, setCreatedContractId] = useState<string | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const { isCapped, plan, isLoading: isSubLoading } = useSubscription();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // Consent state
    const [showPdpaDialog, setShowPdpaDialog] = useState(false);
    const [pdpaConsent, setPdpaConsent] = useState(false);
    const [acceptPrivacy, setAcceptPrivacy] = useState(false);
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptAiDisclaimer, setAcceptAiDisclaimer] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [showLoginDialog, setShowLoginDialog] = useState(false);

    // Cookie name for consent
    const CONSENT_COOKIE = 'lawslane_contract_consent';

    // Storage keys
    const CONTRACT_DATA_KEY = 'lawslane_contract_draft';
    const IMAGES_KEY = 'lawslane_contract_images';

    // Check cookie for existing consent on mount AND restore contract data
    React.useEffect(() => {
        setMounted(true);

        // Read consent from cookie
        const cookies = document.cookie.split(';');
        const consentCookie = cookies.find(c => c.trim().startsWith(CONSENT_COOKIE + '='));
        if (consentCookie) {
            const value = consentCookie.split('=')[1];
            if (value === 'accepted') {
                setAcceptPrivacy(true);
                setAcceptTerms(true);
                setAcceptAiDisclaimer(true);
                setPdpaConsent(true);
                setTurnstileToken('cookie-verified');
            }
        }

        // Restore contract data from sessionStorage (for after login redirect)
        const savedContractData = sessionStorage.getItem(CONTRACT_DATA_KEY);
        const savedImages = sessionStorage.getItem(IMAGES_KEY);

        if (savedContractData) {
            try {
                setContractData(JSON.parse(savedContractData));
                sessionStorage.removeItem(CONTRACT_DATA_KEY);
            } catch (e) {
                console.error('Failed to restore contract data:', e);
            }
        }

        if (savedImages) {
            try {
                setImages(JSON.parse(savedImages));
                sessionStorage.removeItem(IMAGES_KEY);
            } catch (e) {
                console.error('Failed to restore images:', e);
            }
        }
    }, []);

    // Save consent to cookie (valid for 30 days)
    const saveConsentToCookie = () => {
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);
        document.cookie = `${CONSENT_COOKIE}=accepted; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
    };

    const allConsentsAccepted = acceptPrivacy && acceptTerms && acceptAiDisclaimer && turnstileToken;

    // Handle clicking upload button - allow direct upload, consent is checked later
    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            setContractData(null); // Reset previous data when new images are uploaded

            for (const file of Array.from(files)) {
                try {
                    // Create an Image object
                    const img = new Image();
                    img.src = URL.createObjectURL(file);

                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                    });

                    // Calculate new dimensions (max 1200px on longest side)
                    const MAX_DIMENSION = 1200;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_DIMENSION) {
                            height = Math.round((height *= MAX_DIMENSION / width));
                            width = MAX_DIMENSION;
                        }
                    } else {
                        if (height > MAX_DIMENSION) {
                            width = Math.round((width *= MAX_DIMENSION / height));
                            height = MAX_DIMENSION;
                        }
                    }

                    // Draw to canvas
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    if (ctx) {
                        ctx.drawImage(img, 0, 0, width, height);
                        // Compress as JPEG with 0.7 quality
                        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                        setImages(prev => [...prev, compressedDataUrl]);
                    } else {
                        // Fallback if canvas fails
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            if (reader.result) setImages(prev => [...prev, reader.result as string]);
                        };
                        reader.readAsDataURL(file);
                    }

                    URL.revokeObjectURL(img.src);
                } catch (error) {
                    console.error("Error compressing image:", error);
                    // Fallback to uncompressed
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (reader.result) setImages(prev => [...prev, reader.result as string]);
                    };
                    reader.readAsDataURL(file);
                }
            }
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        if (images.length <= 1) {
            setContractData(null);
        }
    };

    const processImage = async () => {
        if (images.length === 0) return;

        if (!user) {
            setShowLoginDialog(true);
            return;
        }

        if (isCapped) {
            toast({
                title: "ถึงขีดจำกัดแล้ว",
                description: `แพ็กเกจ ${plan.name} สแกนได้สูงสุด ${plan.limits.dealsPerMonth} ครั้งต่อเดือน`,
                variant: 'destructive',
            });
            router.push(`/${locale}/pricing`);
            return;
        }

        setIsProcessing(true);
        try {
            const response = await fetch('/api/ai/contract-draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images, locale }),
            });

            const contentType = response.headers.get('content-type');
            if (response.ok && contentType && contentType.includes('application/json')) {
                const data = await response.json();
                setContractData(data);
            } else {
                let errorMessage = 'ไม่สามารถสร้างสัญญาจากรูปภาพได้ โปรดลองอีกครั้ง';
                const errorText = await response.text();

                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData && typeof errorData.error === 'string') {
                        errorMessage = errorData.error;
                    }
                } catch {
                    if (response.status === 413) {
                        errorMessage = 'ไฟล์รูปภาพมีขนาดใหญ่เกินไป กรุณาอัปโหลดรูปภาพที่มีขนาดเล็กลง';
                    } else if (response.status === 404) {
                        errorMessage = 'ไม่พบระบบบริการ AI ในขณะนี้';
                    }
                }

                toast({
                    title: "เกิดข้อผิดพลาด",
                    description: errorMessage,
                    variant: "destructive"
                });
            }
        } catch (error: any) {
            console.error('Processing error:', error);
            toast({
                title: "เกิดข้อผิดพลาด",
                description: error.message || "ไม่สามารถติดต่อเซิร์ฟเวอร์ได้",
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpsell = () => {
        toast({
            title: "ส่งเรื่องให้ทนายตรวจสอบ",
            description: "ระบบกำลังส่งข้อมูลให้ทนายความผู้เชี่ยวชาญ (จำลอง)",
        });
    };

    const handleInputChange = (field: keyof ContractData, value: string | number) => {
        if (!contractData) return;
        setContractData({
            ...contractData,
            [field]: value
        });
    };

    const handleBackToUpload = () => {
        setContractData(null);
        setCreatedContractId(null);
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 0
        }).format(price);
    };

    const handleCopyData = () => {
        if (!contractData) return;

        const text = `📋 ข้อมูลสัญญาเบื้องต้น (กรุณาตรวจสอบและส่งคืน)

👤 ผู้ว่าจ้าง: ${contractData.employer || '_______'}
🆔 เลขบัตรประชาชน: ${contractData.employerId || '_______'}
🏠 ที่อยู่: ${contractData.employerAddress || '_______'}

🔧 ผู้รับจ้าง: ${contractData.contractor || '_______'}
🆔 เลขบัตรประชาชน: ${contractData.contractorId || '_______'}
🏠 ที่อยู่: ${contractData.contractorAddress || '_______'}

📝 ขอบเขตงาน: ${contractData.task || '_______'}
💰 ราคารวม: ${contractData.price ? formatPrice(contractData.price) : '_______'}
💸 มัดจำ: ${contractData.deposit ? formatPrice(contractData.deposit) : '_______'}
📅 กำหนดส่งงาน: ${contractData.deadline || '_______'}
💳 เงื่อนไขการชำระเงิน: ${contractData.paymentTerms || '_______'}

---
สร้างโดย CapDeal by Lawslane`;

        navigator.clipboard.writeText(text).then(() => {
            toast({
                title: "คัดลอกข้อมูลแล้ว",
                description: "ข้อมูลถูกคัดลอกไปยังคลิปบอร์ดแล้ว คุณสามารถส่งให้คู่สัญญาได้ทันที",
                className: "bg-blue-600 text-white border-none",
            });
        }).catch(() => {
            toast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถคัดลอกข้อมูลได้ กรุณาลองคัดลอกด้วยตนเอง",
                variant: "destructive"
            });
        });
    };

    const handleCreateContract = async () => {
        if (!contractData) return;

        // Check if user is logged in
        if (!user) {
            setShowLoginDialog(true);
            return;
        }

        if (isCapped) {
            toast({
                title: "ถึงขีดจำกัดแล้ว",
                description: `แพ็กเกจ ${plan.name} สร้างได้สูงสุด ${plan.limits.dealsPerMonth} ครั้งต่อเดือน`,
                variant: 'destructive',
            });
            router.push(`/${locale}/pricing`);
            return;
        }

        proceedCreateContract();
    };

    const handleLoginRedirect = () => {
        // Save current data to sessionStorage before redirect
        try {
            if (contractData) {
                sessionStorage.setItem(CONTRACT_DATA_KEY, JSON.stringify(contractData));
            }
            if (images.length > 0) {
                sessionStorage.setItem(IMAGES_KEY, JSON.stringify(images));
            }
        } catch (error) {
            console.warn('Failed to save state to sessionStorage due to size limits. User may need to re-upload after login.');
            // Clean up potentially partial/corrupted data
            sessionStorage.removeItem(CONTRACT_DATA_KEY);
            sessionStorage.removeItem(IMAGES_KEY);
        }

        setShowLoginDialog(false);
        router.push(`/${locale}/login?redirect=/services/contracts/screenshot`);
    };

    const proceedCreateContract = async () => {
        if (!contractData) return;

        // If we already created a contract during PDF preview, just redirect
        if (createdContractId) {
            router.push(`/${locale}/contract/${createdContractId}`);
            return;
        }

        setIsCreating(true);
        try {
            // Build employer object, only including defined fields
            const employer: Record<string, string> = { name: contractData.employer || '' };
            if (contractData.employerId) employer.id_card = contractData.employerId;
            if (contractData.employerAddress) employer.address = contractData.employerAddress;

            // Build contractor object, only including defined fields
            const contractor: Record<string, string> = { name: contractData.contractor || '' };
            if (contractData.contractorId) contractor.id_card = contractData.contractorId;
            if (contractData.contractorAddress) contractor.address = contractData.contractorAddress;

            const id = await contractService.createContract({
                title: 'สัญญาจ้างทำของ',
                employer: employer as any,
                contractor: contractor as any,
                task: contractData.task || '',
                price: contractData.price || 0,
                deposit: contractData.deposit || 0,
                deadline: contractData.deadline || '',
                paymentTerms: contractData.paymentTerms || '',
                status: 'draft',
                ownerId: user?.uid || 'anonymous',
            });

            setCreatedContractId(id);

            toast({
                title: "สร้างสัญญาสำเร็จ",
                description: "กำลังนำคุณไปยังหน้าสัญญา...",
                className: "bg-green-600 text-white border-none",
            });

            router.push(`/${locale}/contract/${id}`);
        } catch (error) {
            console.error('Error creating contract:', error);
            toast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถสร้างสัญญาได้ กรุณาลองใหม่อีกครั้ง",
                variant: 'destructive',
            });
        } finally {
            setIsCreating(false);
        }
    };

    const handleAcceptPdpa = () => {
        setAcceptPrivacy(true);
        setAcceptTerms(true);
        setAcceptAiDisclaimer(true);
        setPdpaConsent(true);
        setShowPdpaDialog(false);
        // Save consent to cookie
        saveConsentToCookie();
        // Open file input after consent
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 100);
    };

    return (
        <>
            {/* Consent Dialog */}
            <Dialog open={showPdpaDialog} onOpenChange={setShowPdpaDialog}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-[2rem] border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <ShieldCheck className="w-6 h-6 text-blue-600" />
                            ยินยอมก่อนใช้งาน
                        </DialogTitle>
                        <DialogDescription>
                            กรุณาอ่านและยอมรับเงื่อนไขทั้งหมดก่อนใช้งานบริการ
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-sm text-slate-600 space-y-3 shadow-inner">
                            <h4 className="font-semibold text-slate-800 text-base mb-2">ข้อตกลงและเงื่อนไขแบบย่อ:</h4>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong><Link href="/privacy" target="_blank" className="text-blue-600 hover:text-blue-700 hover:underline">นโยบายความเป็นส่วนตัว</Link>:</strong> ยินยอมให้ประมวลผลข้อมูลส่วนบุคคลในแชทเพื่อสร้างสัญญา</li>
                                <li><strong><Link href="/terms" target="_blank" className="text-blue-600 hover:text-blue-700 hover:underline">ข้อกำหนดการใช้งาน</Link>:</strong> ยอมรับเงื่อนไขการใช้บริการของ Lawslane</li>
                                <li className="text-amber-700"><strong><Link href="/ai-disclaimer" target="_blank" className="text-amber-700 hover:text-amber-800 hover:underline">ข้อจำกัด AI</Link>:</strong> สัญญาที่สร้างเป็นร่างเบื้องต้น ไม่ใช่คำแนะนำทางกฎหมาย ควรตรวจสอบก่อนใช้จริง</li>
                            </ul>
                        </div>

                        <div className="flex items-start space-x-3 p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-400 bg-white transition-all shadow-sm cursor-pointer"
                            onClick={() => {
                                const newValue = (!acceptPrivacy || !acceptTerms || !acceptAiDisclaimer);
                                setAcceptPrivacy(newValue);
                                setAcceptTerms(newValue);
                                setAcceptAiDisclaimer(newValue);
                            }}
                        >
                            <Checkbox
                                id="accept-all"
                                checked={acceptPrivacy && acceptTerms && acceptAiDisclaimer}
                                onCheckedChange={(checked) => {
                                    const val = checked === true;
                                    setAcceptPrivacy(val);
                                    setAcceptTerms(val);
                                    setAcceptAiDisclaimer(val);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1 h-5 w-5 data-[state=checked]:bg-blue-600"
                            />
                            <div className="flex-1">
                                <label htmlFor="accept-all" className="font-bold text-slate-800 cursor-pointer text-base">
                                    ข้าพเจ้าได้อ่านและยอมรับเงื่อนไขทั้งหมด
                                </label>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    ครอบคลุมนโยบายความเป็นส่วนตัว, ข้อกำหนดการใช้งาน และข้อจำกัดความรับผิดของ AI
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Removed Turnstile CAPTCHA from here since frontend backend doesn't check it for draft */}

                    <DialogFooter className="gap-2 sm:gap-0 mt-4 border-t pt-4">
                        <Button
                            variant="outline"
                            className="rounded-full px-6"
                            onClick={() => setShowPdpaDialog(false)}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            onClick={() => setShowPdpaDialog(false)}
                            disabled={!acceptPrivacy || !acceptTerms || !acceptAiDisclaimer}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-full px-6"
                        >
                            <ShieldCheck className="w-4 h-4 mr-2" />
                            ยอมรับข้อตกลงและปิดหน้าต่าง
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
                <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <LogIn className="w-6 h-6 text-blue-600" />
                            ต้องเข้าสู่ระบบ
                        </DialogTitle>
                        <DialogDescription>
                            ฟีเจอร์ &quot;สร้างลิงก์สัญญาออนไลน์&quot; ต้องเข้าสู่ระบบก่อนใช้งาน
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100 shadow-sm">
                            <p className="text-sm text-blue-800">
                                💡 <strong>หมายเหตุ:</strong> หากคุณต้องการบันทึกเป็น PDF แทน
                                สามารถกด &quot;ยกเลิก&quot; แล้วเลือกปุ่ม &quot;บันทึก PDF&quot; ได้เลย
                                โดยไม่ต้องเข้าสู่ระบบ
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            className="rounded-full px-6"
                            onClick={() => setShowLoginDialog(false)}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            onClick={handleLoginRedirect}
                            className="bg-blue-600 hover:bg-blue-700 rounded-full px-6"
                        >
                            <LogIn className="w-4 h-4 mr-2" />
                            เข้าสู่ระบบ
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-slate-50">
                {/* Main Content Overlap - Single Column */}
                <div className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12 flex flex-col justify-center">
                    {/* Show Upload Section when no contract */}
                    {!contractData ? (
                        <FadeIn direction="up">
                            <Card className="border-none shadow-none md:border-solid md:border-white/40 md:shadow-2xl md:shadow-blue-900/10 rounded-[2.5rem] bg-transparent md:bg-white/80 md:backdrop-blur-2xl md:ring-1 md:ring-black/5">
                                <CardHeader className="md:bg-white/50 border-b border-transparent md:border-slate-100/50 p-6 md:p-8 pb-4">
                                    <div className="flex justify-center mb-4">
                                        <div className="w-16 h-16 rounded-2xl bg-blue-100/50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100/50">
                                            <FileSignature className="w-8 h-8" />
                                        </div>
                                    </div>
                                    <CardTitle className="text-xl md:text-2xl font-bold text-slate-800 text-center">
                                        อัปโหลดรูปแชทเพื่อเริ่มร่างสัญญา
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-8 p-8 max-w-xl mx-auto">
                                    <div className="w-full grid grid-cols-2 gap-4">
                                        {images.map((img, index) => (
                                            <div key={index} className="relative aspect-square rounded-2xl border-2 border-transparent hover:border-blue-400 overflow-hidden group shadow-sm transition-all">
                                                <img src={img} alt={`Uploaded chat ${index + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                                                    className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 backdrop-blur-md"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}

                                        <div
                                            className={`relative aspect-square rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-50/50 hover:border-blue-400 hover:shadow-inner group overflow-hidden
                                            ${images.length === 0 ? 'col-span-2 aspect-[16/9] bg-slate-50/50 border-slate-300/80 hover:border-blue-500 rounded-3xl' : 'border-slate-300/80 bg-slate-50/30'}`}
                                            onClick={handleUploadClick}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-50/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="space-y-4 p-6 relative z-10">
                                                <div className="w-16 h-16 mx-auto rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                                                    <Plus className="w-8 h-8 text-blue-500" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-700 text-lg">
                                                        {images.length > 0 ? 'เพิ่มรูปภาพ' : 'คลิกเพื่ออัปโหลดรูปแชทของคุณ'}
                                                    </p>
                                                    {images.length === 0 && (
                                                        <p className="text-sm text-slate-500 mt-2">รองรับหลายรูปภาพ (PNG, JPG)</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={handleImageUpload}
                                    />

                                    {/* Inline Consent */}
                                    {images.length > 0 && (
                                        <div className="flex items-start space-x-3 p-4 rounded-xl border border-slate-200 bg-white/50 transition-all cursor-pointer hover:border-blue-400"
                                            onClick={() => {
                                                const val = (!acceptPrivacy || !acceptTerms || !acceptAiDisclaimer);
                                                setAcceptPrivacy(val);
                                                setAcceptTerms(val);
                                                setAcceptAiDisclaimer(val);
                                            }}
                                        >
                                            <Checkbox
                                                id="inline-consent"
                                                checked={acceptPrivacy && acceptTerms && acceptAiDisclaimer}
                                                onCheckedChange={(checked) => {
                                                    const val = checked === true;
                                                    setAcceptPrivacy(val);
                                                    setAcceptTerms(val);
                                                    setAcceptAiDisclaimer(val);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="mt-0.5 h-5 w-5 data-[state=checked]:bg-blue-600"
                                            />
                                            <div className="flex-1">
                                                <label htmlFor="inline-consent" className="font-semibold text-slate-700 cursor-pointer text-sm">
                                                    ข้าพเจ้ายอมรับ <button onClick={(e) => { e.stopPropagation(); setShowPdpaDialog(true); }} className="text-blue-600 hover:text-blue-700 hover:underline inline-block">เงื่อนไขและข้อตกลง</button> สำหรับการสร้างสัญญาด้วย AI
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        onClick={processImage}
                                        disabled={images.length === 0 || isProcessing || !acceptPrivacy || !acceptTerms || !acceptAiDisclaimer}
                                        className="w-full bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 text-white shadow-xl shadow-blue-900/20 rounded-2xl py-7 text-lg font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] border border-blue-600/50 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 className="w-6 h-6 mr-3 animate-spin text-blue-200" />
                                                กำลังวิเคราะห์แชทด้วย AI...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-6 h-6 mr-3 text-yellow-300" />
                                                สร้างร่างสัญญาอัจฉริยะ
                                            </>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        </FadeIn>
                    ) : (
                        /* Show Contract Result when ready */
                        <FadeIn direction="up" className="space-y-6 max-w-3xl mx-auto">
                            {/* Back Button */}
                            <Button
                                variant="ghost"
                                onClick={handleBackToUpload}
                                className="text-slate-600 hover:text-slate-800 mb-0 -ml-2 hover:bg-white/50 rounded-full"
                            >
                                <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                                กลับไปอัปโหลดใหม่
                            </Button>

                            {/* Contract Draft */}
                            <Card className="border border-white/60 shadow-2xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white/90 backdrop-blur-xl ring-1 ring-slate-900/5">
                                <CardHeader className="border-b border-slate-100/80 p-6 md:p-8 bg-white/50">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-3">
                                            <div className="p-2.5 rounded-2xl bg-blue-100/50 text-blue-700 border border-blue-100 shadow-sm">
                                                <FileSignature className="w-6 h-6" />
                                            </div>
                                            ร่างสัญญาฉบับย่อ
                                        </CardTitle>
                                        <div className="px-3 py-1 rounded-full bg-emerald-100/50 border border-emerald-200 text-emerald-700 text-sm font-medium flex items-center gap-1.5 shadow-sm">
                                            <CheckCircle className="w-4 h-4" />
                                            สร้างสำเร็จ
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6 p-6 md:p-8">

                                    {/* Warning to use real legal names */}
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-amber-100 rounded-full text-amber-600 mt-0.5">
                                                <AlertTriangle className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-amber-800 text-sm">⚠️ กรุณาตรวจสอบข้อมูล</h4>
                                                <p className="text-sm text-amber-700 mt-1">
                                                    ข้อมูลด้านล่างดึงจากแชท อาจไม่ใช่ชื่อจริง กรุณาแก้ไขให้เป็น<strong>ชื่อ-นามสกุลตามบัตรประชาชน</strong>ก่อนสร้าง PDF
                                                </p>
                                                <p className="text-sm text-amber-600 mt-1">
                                                    ช่องที่แสดง <span className="font-mono bg-amber-100 px-1 rounded">_______</span> = ไม่พบข้อมูลในแชท ต้องกรอกเอง
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Form Fields */}
                                    {/* ผู้ว่าจ้าง Section */}
                                    <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                                        <h4 className="font-semibold text-slate-700 text-sm">👤 ผู้ว่าจ้าง</h4>
                                        <div className="space-y-2">
                                            <Label className="text-slate-600">ชื่อ-นามสกุล <span className="text-red-500">*</span></Label>
                                            <Input
                                                value={contractData.employer}
                                                onChange={(e) => handleInputChange('employer', e.target.value)}
                                                placeholder="ชื่อ-นามสกุลตามบัตรประชาชน"
                                                className={`bg-white rounded-xl ${!contractData.employer ? 'border-amber-400 bg-amber-50' : ''}`}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label className="text-slate-600">เลขบัตรประชาชน</Label>
                                                <Input
                                                    value={contractData.employerId || ''}
                                                    onChange={(e) => handleInputChange('employerId', e.target.value)}
                                                    placeholder="x-xxxx-xxxxx-xx-x"
                                                    className="bg-white rounded-xl"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-slate-600">ที่อยู่</Label>
                                                <Input
                                                    value={contractData.employerAddress || ''}
                                                    onChange={(e) => handleInputChange('employerAddress', e.target.value)}
                                                    placeholder="ที่อยู่ตามบัตรประชาชน"
                                                    className="bg-white rounded-xl"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* ผู้รับจ้าง Section */}
                                    <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                                        <h4 className="font-semibold text-slate-700 text-sm">🔧 ผู้รับจ้าง</h4>
                                        <div className="space-y-2">
                                            <Label className="text-slate-600">ชื่อ-นามสกุล <span className="text-red-500">*</span></Label>
                                            <Input
                                                value={contractData.contractor}
                                                onChange={(e) => handleInputChange('contractor', e.target.value)}
                                                placeholder="ชื่อ-นามสกุลตามบัตรประชาชน"
                                                className={`bg-white rounded-xl ${!contractData.contractor ? 'border-amber-400 bg-amber-50' : ''}`}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label className="text-slate-600">เลขบัตรประชาชน</Label>
                                                <Input
                                                    value={contractData.contractorId || ''}
                                                    onChange={(e) => handleInputChange('contractorId', e.target.value)}
                                                    placeholder="x-xxxx-xxxxx-xx-x"
                                                    className="bg-white rounded-xl"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-slate-600">ที่อยู่</Label>
                                                <Input
                                                    value={contractData.contractorAddress || ''}
                                                    onChange={(e) => handleInputChange('contractorAddress', e.target.value)}
                                                    placeholder="ที่อยู่ตามบัตรประชาชน"
                                                    className="bg-white rounded-xl"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-600">ขอบเขตงาน <span className="text-red-500">*</span></Label>
                                        <Textarea
                                            value={contractData.task}
                                            onChange={(e) => handleInputChange('task', e.target.value)}
                                            rows={3}
                                            placeholder="รายละเอียดงานที่ต้องทำ"
                                            className={`bg-white resize-none rounded-xl ${!contractData.task ? 'border-amber-400 bg-amber-50' : ''}`}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-slate-600">ราคารวม (บาท) <span className="text-red-500">*</span></Label>
                                            <Input
                                                value={contractData.price || ''}
                                                onChange={(e) => handleInputChange('price', Number(e.target.value))}
                                                type="number"
                                                placeholder="0"
                                                className={`bg-white rounded-xl ${!contractData.price ? 'border-amber-400 bg-amber-50' : ''}`}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-600">มัดจำ (บาท)</Label>
                                            <Input
                                                value={contractData.deposit || ''}
                                                onChange={(e) => handleInputChange('deposit', Number(e.target.value))}
                                                type="number"
                                                placeholder="0"
                                                className="bg-white rounded-xl"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-600">กำหนดส่งงาน <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={contractData.deadline}
                                            onChange={(e) => handleInputChange('deadline', e.target.value)}
                                            placeholder="เช่น วันที่ 15 กุมภาพันธ์ 2569"
                                            className={`bg-white rounded-xl ${!contractData.deadline ? 'border-amber-400 bg-amber-50' : ''}`}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-600">เงื่อนไขการชำระเงิน</Label>
                                        <Input
                                            value={contractData.paymentTerms}
                                            onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
                                            placeholder="เช่น ชำระส่วนที่เหลือเมื่องานเสร็จ"
                                            className={`bg-white rounded-xl ${!contractData.paymentTerms ? 'border-amber-400 bg-amber-50' : ''}`}
                                        />
                                    </div>

                                    <div className="space-y-4 pt-4 mt-2">
                                        {/* Alerts */}
                                        {contractData.missingInfo.length > 0 && (
                                            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 animate-in slide-in-from-bottom-2">
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2 bg-orange-100 rounded-full text-orange-600 mt-0.5">
                                                        <AlertTriangle className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-orange-800 text-sm">⚠️ ข้อมูลที่ไม่พบในแชท</h4>
                                                        <ul className="mt-2 space-y-1">
                                                            {contractData.missingInfo.map((info, i) => (
                                                                <li key={i} className="text-sm text-orange-700 flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                                                    {info}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {contractData.riskyTerms.length > 0 && (
                                            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 animate-in slide-in-from-bottom-2">
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2 bg-red-100 rounded-full text-red-600 mt-0.5">
                                                        <Shield className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-red-800 text-sm">⛔️ ข้อความที่มีความเสี่ยง!</h4>
                                                        <ul className="mt-2 space-y-1">
                                                            {contractData.riskyTerms.map((term, i) => (
                                                                <li key={i} className="text-sm text-red-700 flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                                                    {term}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        <Button
                                                            variant="link"
                                                            className="text-red-600 p-0 h-auto font-semibold mt-3 text-sm hover:text-red-700 group"
                                                            onClick={handleUpsell}
                                                        >
                                                            ให้ทนายช่วยตรวจแก้ (เริ่มต้น 500฿) <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Copy Data Button */}
                                    <Button
                                        variant="outline"
                                        onClick={handleCopyData}
                                        className="w-full border-2 border-blue-100 bg-blue-50/30 text-blue-700 hover:bg-blue-100 hover:text-blue-800 rounded-2xl h-14 text-base font-semibold transition-all group"
                                    >
                                        <Copy className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
                                        คัดลอกข้อมูลเพื่อส่งให้คู่สัญญา
                                    </Button>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                        <Button
                                            onClick={handleCreateContract}
                                            disabled={isCreating}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-full h-12 text-lg shadow-lg shadow-blue-900/10 transition-all hover:-translate-y-1"
                                        >
                                            {isCreating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Share2 className="w-5 h-5 mr-2" />}
                                            สร้างลิงก์สัญญาออนไลน์
                                        </Button>
                                        <Button
                                            onClick={async () => {
                                                if (!contractData) return;

                                                // Check if user is logged in
                                                if (!user) {
                                                    setShowLoginDialog(true);
                                                    return;
                                                }

                                                // Check if already capped
                                                if (isCapped && !createdContractId) {
                                                    toast({
                                                        title: "ถึงขีดจำกัดแล้ว",
                                                        description: `แพ็กเกจ ${plan.name} สร้างได้สูงสุด ${plan.limits.dealsPerMonth} ครั้งต่อเดือน`,
                                                        variant: 'destructive',
                                                    });
                                                    router.push(`/${locale}/pricing`);
                                                    return;
                                                }

                                                setIsDownloadingPDF(true);
                                                try {
                                                    // If we haven't created a contract record yet for this analysis, create one
                                                    if (!createdContractId) {
                                                        const employer: Record<string, string> = { name: contractData.employer || '' };
                                                        if (contractData.employerId) employer.id_card = contractData.employerId;
                                                        if (contractData.employerAddress) employer.address = contractData.employerAddress;

                                                        const contractor: Record<string, string> = { name: contractData.contractor || '' };
                                                        if (contractData.contractorId) contractor.id_card = contractData.contractorId;
                                                        if (contractData.contractorAddress) contractor.address = contractData.contractorAddress;

                                                        const id = await contractService.createContract({
                                                            title: 'สัญญาจ้างทำของ (ดาวน์โหลด PDF)',
                                                            employer: employer as any,
                                                            contractor: contractor as any,
                                                            task: contractData.task || '',
                                                            price: contractData.price || 0,
                                                            deposit: contractData.deposit || 0,
                                                            deadline: contractData.deadline || '',
                                                            paymentTerms: contractData.paymentTerms || '',
                                                            status: 'draft',
                                                            ownerId: user.uid,
                                                        });
                                                        setCreatedContractId(id);
                                                    }

                                                    await generateContractPDF(contractData);
                                                } catch (error) {
                                                    console.error('PDF Download Error:', error);
                                                } finally {
                                                    setIsDownloadingPDF(false);
                                                }
                                            }}
                                            disabled={isDownloadingPDF}
                                            className="w-full bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 rounded-full h-12 text-lg transition-all hover:-translate-y-1"
                                        >
                                            {isDownloadingPDF ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                                            {isDownloadingPDF ? 'กำลังสร้าง...' : 'โหลด PDF เท่านั้น'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </FadeIn>
                    )}
                </div>
            </div >
        </>
    );
}
