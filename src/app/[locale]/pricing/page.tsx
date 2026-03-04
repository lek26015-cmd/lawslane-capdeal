import { PricingCards } from '@/components/pricing/pricing-cards';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'แพ็กเกจ - Lawslane CapDeal',
    description: 'เลือกแพ็กเกจที่เหมาะสมกับการใช้งานของคุณ',
};

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-gray-50/50 py-12 md:py-20 lg:py-24">
            <div className="container mx-auto px-4 md:px-6">
                <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900 mb-6">
                        เลือกแพ็กเกจที่เหมาะกับธุรกิจคุณ
                    </h1>
                    <p className="text-lg md:text-xl text-gray-600">
                        ระบบจัดการใบเสร็จและค่าใช้จ่ายที่ช่วยให้ SME ทำงานได้ง่ายขึ้น สมัครเพื่อให้ผู้ช่วย AI แบ่งเบาภาระของคุณ
                    </p>
                </div>

                <PricingCards />

                <div className="mt-20 text-center text-sm text-gray-500 max-w-2xl mx-auto">
                    <p>
                        ราคาทั้งหมดยังไม่รวมภาษีมูลค่าเพิ่ม • สามารถยกเลิกได้ตลอดเวลาโดยไม่มีค่าธรรมเนียมแอบแฝง • ระบบรองรับการชำระเงินผ่านบัตรเครดิตและพร้อมเพย์
                    </p>
                </div>
            </div>
        </div>
    );
}
