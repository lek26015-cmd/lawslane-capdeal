'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PartyPopper, CheckCircle, ArrowRight, FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/navigation';
import { FadeIn } from '@/components/fade-in';

export default function RegistrationSuccessPage() {
    return (
        <div className="container mx-auto px-4 py-20 max-w-2xl text-center">
            <FadeIn direction="up">
                <div className="mb-8 flex justify-center">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-xl shadow-green-200">
                            <CheckCircle className="w-12 h-12" />
                        </div>
                        <div className="absolute -top-2 -right-2">
                            <PartyPopper className="w-8 h-8 text-yellow-500 animate-bounce" />
                        </div>
                    </div>
                </div>

                <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/90 backdrop-blur-xl ring-1 ring-black/5 p-8 md:p-12">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight">
                            สมัครสมาชิกสำเร็จ!
                        </CardTitle>
                        <p className="text-slate-500 text-lg md:text-xl mt-4">
                            ยินดีต้อนรับสู่ Lawslane: Cap & Deal <br className="hidden md:block" />
                            ระบบ AI ผู้ช่วยร่างสัญญาอัจฉริยะของคุณ
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-10">
                        <div className="space-y-4">
                            <p className="text-slate-600">
                                คุณสามารถเริ่มต้นใช้งานเพื่อประหยัดเวลาและลดความเสี่ยงในการทำธุรกิจได้ทันที
                            </p>

                            <div className="grid gap-4 mt-8">
                                <Button asChild className="h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-xl font-bold shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95 group">
                                    <Link href="/services/contracts/screenshot" className="flex items-center gap-3">
                                        <FileSignature className="w-6 h-6" />
                                        เริ่มสแกนแชทร่างสัญญา
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                </Button>

                                <Button variant="outline" asChild className="h-14 rounded-2xl border-2 hover:bg-slate-50 text-lg font-medium">
                                    <Link href="/dashboard">ไปที่แดชบอร์ดของคุณ</Link>
                                </Button>
                            </div>
                        </div>

                        <p className="text-slate-400 text-sm">
                            ต้องการความช่วยเหลือ? <Link href="/contact" className="text-blue-500 hover:underline">ติดต่อเรา</Link>
                        </p>
                    </CardContent>
                </Card>
            </FadeIn>
        </div>
    );
}
