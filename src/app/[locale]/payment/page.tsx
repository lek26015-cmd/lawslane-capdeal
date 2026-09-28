import { redirect } from 'next/navigation';

/**
 * เดิมหน้านี้รับเงินค่าปรึกษา ฿500 / ค่านัด ฿3,500 / ค่าบริการเพิ่มเติม เข้าบัญชีแพลตฟอร์ม
 * (สลิปโอน + แอดมินอนุมัติ) ตอนนี้ลูกความโอนค่าบริการให้ทนายโดยตรงผ่านห้องแชทบนเว็บหลัก
 * Lawslane ไม่รับหรือถือเงินค่าทนาย — หน้านี้เหลือแค่พาลิงก์เก่าไปที่ที่ถูกต้อง
 * (ดู LAWSLANE-PLAN-06 ภาคผนวก A · แพลน CapDeal ผ่าน Stripe อยู่ที่ /pricing, /checkout ไม่เกี่ยว)
 */
const MAIN_SITE = 'https://www.lawslane.com';
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export default async function PaymentRedirectPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { locale } = await params;
    const sp = await searchParams;
    const pick = (k: string) => {
        const v = sp[k];
        const s = Array.isArray(v) ? v[0] : v;
        return s && SAFE_ID.test(s) ? s : null;
    };
    const lang = ['th', 'en', 'zh'].includes(locale) ? locale : 'th';
    const chatId = pick('chatId');
    const lawyerId = pick('lawyerId');

    if (chatId) redirect(`${MAIN_SITE}/${lang}/chat/${chatId}`);
    if (lawyerId) redirect(`${MAIN_SITE}/${lang}/lawyers/${lawyerId}`);
    redirect(`${MAIN_SITE}/${lang}/lawyers`);
}
