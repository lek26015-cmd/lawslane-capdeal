'use client';

import React, { useRef, useState } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { confirmSigningOtp, otpErrorMessage, sendSigningOtp, toE164Thai } from '@/lib/otp-client';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** เรียกหลังยืนยัน OTP สำเร็จ — throw Error(message) เพื่อแสดงข้อความผิดพลาด */
    onVerified: (phoneIdToken: string) => Promise<void>;
};

/** ยืนยันเบอร์โทรด้วย OTP ก่อนบันทึกลายเซ็น (ใช้ทั้งหน้าเจ้าของและหน้าแชร์) */
export function OtpSignDialog({ open, onOpenChange, onVerified }: Props) {
    const recaptchaRef = useRef<HTMLDivElement>(null);
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = () => {
        setPhone('');
        setCode('');
        setConfirmation(null);
        setError(null);
        setBusy(false);
    };

    const handleOpenChange = (next: boolean) => {
        if (busy) return;
        if (!next) reset();
        onOpenChange(next);
    };

    const handleSend = async () => {
        const e164 = toE164Thai(phone);
        if (!e164) {
            setError('กรุณาระบุหมายเลขโทรศัพท์มือถือ 10 หลัก เช่น 0812345678');
            return;
        }
        if (!recaptchaRef.current) return;
        setBusy(true);
        setError(null);
        try {
            setConfirmation(await sendSigningOtp(e164, recaptchaRef.current));
        } catch (e) {
            console.error('Error sending OTP:', e);
            setError(otpErrorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    const handleConfirm = async () => {
        if (!confirmation) return;
        setBusy(true);
        setError(null);
        let idToken: string;
        try {
            idToken = await confirmSigningOtp(confirmation, code);
        } catch (e) {
            console.error('Error verifying OTP:', e);
            setError(otpErrorMessage(e));
            setBusy(false);
            return;
        }
        try {
            await onVerified(idToken);
            reset();
            onOpenChange(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'บันทึกลายเซ็นไม่สำเร็จ');
            // token ใช้ต่อไม่ได้แน่นอนหลังผิดพลาดบางแบบ — ให้ขอรหัสใหม่
            setConfirmation(null);
            setCode('');
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md bg-white border-none shadow-2xl rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-slate-900">ยืนยันการเซ็นด้วยเบอร์โทรศัพท์ (OTP)</DialogTitle>
                    <DialogDescription className="text-slate-600">
                        {!confirmation
                            ? 'ระบุเบอร์โทรของคุณเพื่อรับรหัส OTP เบอร์นี้จะถูกบันทึกเป็นหลักฐานการเซ็น และแก้ไขไม่ได้หลังยืนยัน'
                            : 'กรอกรหัส OTP 6 หลักที่ได้รับทาง SMS'}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2 space-y-2">
                    {!confirmation ? (
                        <>
                            <Label>หมายเลขโทรศัพท์มือถือ</Label>
                            <Input
                                type="tel"
                                inputMode="tel"
                                placeholder="08X-XXX-XXXX"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                disabled={busy}
                            />
                        </>
                    ) : (
                        <>
                            <Label>รหัส OTP</Label>
                            <Input
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="XXXXXX"
                                maxLength={6}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                disabled={busy}
                                className="text-center tracking-widest text-lg font-bold"
                            />
                        </>
                    )}
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div ref={recaptchaRef} />
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy} className="rounded-xl">
                        ยกเลิก
                    </Button>
                    {!confirmation ? (
                        <Button onClick={handleSend} disabled={busy || !phone} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">
                            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            รับรหัส OTP
                        </Button>
                    ) : (
                        <Button onClick={handleConfirm} disabled={busy || code.length !== 6} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">
                            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            ยืนยันและเซ็นสัญญา
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
