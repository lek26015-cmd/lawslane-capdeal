'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, ShieldCheck, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/navigation';
import { useParams } from 'next/navigation';

export default function AIDisclaimerPage() {
    const t = useTranslations('AIDisclaimer');
    const { locale } = useParams();

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/80 backdrop-blur-xl ring-1 ring-black/5">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-amber-100 text-amber-600 shadow-sm border border-amber-200">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold text-slate-800">
                                ข้อจำกัดความรับผิดชอบของ AI
                            </CardTitle>
                            <p className="text-slate-500 mt-1">AI Disclaimer & Safety Guidelines</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                    <section className="space-y-4">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Scale className="w-5 h-5 text-blue-600" />
                            ไม่ใช่คำแนะนำทางกฎหมาย
                        </h3>
                        <div className="prose prose-slate max-w-none text-slate-600">
                            <p>
                                ข้อมูลและสัญญาที่สร้างขึ้นโดยระบบ AI ของ Lawslane เป็นเพียง <strong>"ร่างเบื้องต้น"</strong> ที่ประมวลผลจากข้อมูลที่ท่านจัดหามาให้เท่านั้น
                                ระบบ AI ไม่ใช่ทนายความและไม่สามารถให้คำแนะนำทางกฎหมาย (Legal Advice) ที่มีผลผูกพันได้
                            </p>
                            <p className="bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
                                "เราขอแนะนำอย่างยิ่งให้ท่านตรวจสอบความถูกต้องของข้อมูลและเงื่อนไขในสัญญาทุกครั้งก่อนนำไปใช้งานจริง"
                            </p>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-green-600" />
                            แนวทางการใช้งานที่ปลอดภัย
                        </h3>
                        <ul className="grid gap-4 sm:grid-cols-2">
                            <li className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                <h4 className="font-bold text-slate-800 mb-1">1. ตรวจสอบชื่อและตัวตน</h4>
                                <p className="text-sm text-slate-500">ตรวจสอบชื่อ-นามสกุล และเลขบัตรประชาชนให้ตรงกับความเป็นจริง</p>
                            </li>
                            <li className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                <h4 className="font-bold text-slate-800 mb-1">2. ตรวจสอบขอบเขตงาน</h4>
                                <p className="text-sm text-slate-500">ระบุรายละเอียดงานและราคาให้ชัดเจนเพื่อป้องกันการโต้แย้งในอนาคต</p>
                            </li>
                            <li className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                <h4 className="font-bold text-slate-800 mb-1">3. ความเสี่ยงของ AI</h4>
                                <p className="text-sm text-slate-500">AI อาจมีการสร้างข้อมูลที่คลาดเคลื่อน (Hallucination) ในบางกรณี</p>
                            </li>
                            <li className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                <h4 className="font-bold text-slate-800 mb-1">4. ข้อมูลส่วนบุคคล</h4>
                                <p className="text-sm text-slate-500">ระบบจะประมวลผลข้อมูลตามนโยบายความเป็นส่วนตัวของเราเท่านั้น</p>
                            </li>
                        </ul>
                    </section>

                    <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-4 justify-center">
                        <Button asChild className="rounded-full px-8 py-6 bg-blue-600 hover:bg-blue-700 text-lg">
                            <Link href="/">กลับสู่หน้าหลัก</Link>
                        </Button>
                        <Button variant="outline" asChild className="rounded-full px-8 py-6 text-lg border-2">
                            <Link href="/services/contracts/screenshot">เริ่มสร้างสัญญาใหม่</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
