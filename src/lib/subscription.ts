export interface SubscriptionPlan {
    id: string;
    name: string;
    price: number;
    yearlyPrice: number;
    interval: 'month' | 'year';
    features: string[];
    limits: {
        dealsPerMonth: number;
    };
    stripePriceId: string;
    stripeYearlyPriceId?: string;
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
    free: {
        id: 'free',
        name: 'Free',
        price: 0,
        yearlyPrice: 0,
        interval: 'month',
        features: [
            'วิเคราะห์แชทและสร้างสัญญา 8 ฉบับ/เดือน',
            'รองรับ Line, Messenger และแอปแชทอื่น',
            'ร่างสัญญากู้ยืม, ซื้อขาย, จ้างงานเบื้องต้น',
            'ดาวน์โหลดไฟล์ PDF พร้อมใช้งาน'
        ],
        limits: {
            dealsPerMonth: 8,
        },
        stripePriceId: '',
    },
    lite: {
        id: 'lite',
        name: 'Lite',
        price: 159,
        yearlyPrice: 1590, // 159 * 10 months (2 months free)
        interval: 'month',
        features: [
            'วิเคราะห์แชทและสร้างสัญญา 30 ฉบับ/เดือน',
            'ไม่มีลายน้ำ Lawslane บนเอกสาร',
            'ประมวลผลด้วย AI ความเร็วสูง',
            'เก็บประวัติสัญญาย้อนหลังได้ไม่จำกัด',
            'รองรับการแคปหน้าจอแชทแบบยาว',
            'สามารถแนบเอกสารแนบท้ายสัญญาได้'
        ],
        limits: {
            dealsPerMonth: 30,
        },
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_LITE || '',
        stripeYearlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_LITE_YEARLY || '',
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        price: 249,
        yearlyPrice: 2490, // 249 * 10 months (2 months free)
        interval: 'month',
        features: [
            'วิเคราะห์แชทและสร้างสัญญา 100 ฉบับ/เดือน',
            'ทุกฟีเจอร์ในแพ็กเกจ Lite',
            'รองรับคู่สัญญาหลายฝ่าย',
            'สามารถแนบเอกสารแนบท้ายสัญญาได้'
        ],
        limits: {
            dealsPerMonth: 100,
        },
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO || '',
        stripeYearlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_YEARLY || '',
    },
    scale: {
        id: 'scale',
        name: 'Scale',
        price: 1049,
        yearlyPrice: 10490, // 1049 * 10 months (2 months free)
        interval: 'month',
        features: [
            'วิเคราะห์แชทและสร้างสัญญา 1,000 ฉบับ/เดือน',
            'ทุกฟีเจอร์ในแพ็กเกจ Pro',
            'ระบบจัดการสัญญาสำหรับทีมและองค์กร',
            'สามารถแนบเอกสารแนบท้ายสัญญาได้'
        ],
        limits: {
            dealsPerMonth: 1000,
        },
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_SCALE || '',
        stripeYearlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_SCALE_YEARLY || '',
    },
};

export type PlanId = keyof typeof SUBSCRIPTION_PLANS;
