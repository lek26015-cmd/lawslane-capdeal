'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, Eye, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/navigation';

export default function PrivacyPage() {
    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/80 backdrop-blur-xl ring-1 ring-black/5">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8 text-center">
                    <div className="w-20 h-20 mx-auto rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center mb-6 shadow-sm border border-blue-200">
                        <Shield className="w-10 h-10" />
                    </div>
                    <CardTitle className="text-3xl font-bold text-slate-800">
                        นโยบายความเป็นส่วนตัว
                    </CardTitle>
                    <p className="text-slate-500 mt-2 text-lg">Privacy Policy</p>
                </CardHeader>
                <CardContent className="p-8 space-y-10">
                    <section className="space-y-4">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                            <Eye className="w-6 h-6 text-blue-500" />
                            ข้อมูลที่เราเก็บรวบรวม
                        </h3>
                        <div className="prose prose-slate max-w-none text-slate-600">
                            <p>เพื่อให้การบริการสแกนและร่างสัญญามีประสิทธิภาพ เราเก็บรวบรวมข้อมูลดังนี้:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>ข้อมูลรูปภาพ (Screenshots):</strong> รูปภาพแชทที่ท่านอัปโหลดจะถูกส่งไปยังระบบ AI เพื่อประมวลผลเป็นร่างสัญญา</li>
                                <li><strong>ข้อมูลบัญชีผู้ใช้:</strong> ชื่อ อีเมล และข้อมูลโปรไฟล์เมื่อท่านลงทะเบียนใช้งาน</li>
                                <li><strong>ข้อมูลการทำสัญญา:</strong> รายละเอียดที่ประมวลผลได้จาก AI เช่น ชื่อคู่สัญญา ราคา และขอบเขตงาน</li>
                            </ul>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                            <Lock className="w-6 h-6 text-indigo-500" />
                            การรักษาความปลอดภัยของข้อมูล
                        </h3>
                        <div className="prose prose-slate max-w-none text-slate-600">
                            <p>
                                Lawslane ให้ความสำคัญสูงสุดกับการปกป้องข้อมูลของท่าน เรามีการใช้ระบบเข้ารหัสระดับมาตรฐานสากล (SSL/TLS)
                                ข้อมูลทั้งหมดจะถูกจัดเก็บในระบบ Cloud ที่มีความปลอดภัยสูง และมีระบบควบคุมการเข้าถึงข้อมูลที่เข้มงวด
                            </p>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                            <FileText className="w-6 h-6 text-emerald-500" />
                            วัตถุประสงค์การใช้งาน
                        </h3>
                        <div className="prose prose-slate max-w-none text-slate-600">
                            <ul className="list-disc pl-5 space-y-2">
                                <li>เพื่อประมวลผลร่างสัญญาตามคำขอของท่าน</li>
                                <li>เพื่อพัฒนาและปรับปรุงระบบ AI ของเราให้มีความแม่นยำมากขึ้น</li>
                                <li>เพื่อติดต่อสื่อสารและแจ้งข้อมูลข่าวสาร/สิทธิพิเศษจาก Lawslane</li>
                                <li>เพื่อป้องกันการแสวงหาประโยชน์โดยมิชอบ หรือการใช้งานที่ผิดกฎหมาย</li>
                            </ul>
                        </div>
                    </section>

                    <div className="pt-8 border-t border-slate-100 flex justify-center">
                        <Button asChild className="rounded-full px-12 py-7 bg-blue-600 hover:bg-blue-700 text-xl font-bold shadow-xl shadow-blue-500/20 transition-all hover:scale-105">
                            <Link href="/">ตกลงและกลับสู่หน้าหลัก</Link>
                        </Button>
                    </div>

                    <p className="text-center text-slate-400 text-sm">
                        ปรับปรุงล่าสุดเมื่อวันที่ 8 มีนาคม 2026
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
