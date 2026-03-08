import { Firestore, collection, addDoc, doc, setDoc, Timestamp } from 'firebase/firestore';

export const SAMPLE_ARTICLES = [
    {
        title: "กฎหมายแรงงานที่ควรรู้: สิทธิลูกจ้างเมื่อถูกเลิกจ้าง",
        description: "ทำความเข้าใจสิทธิของคุณเมื่อถูกเลิกจ้าง ค่าชดเชยที่ควรได้รับ และขั้นตอนการเรียกร้องสิทธิตามกฎหมายแรงงาน",
        content: "<p>การถูกเลิกจ้างเป็นเรื่องที่ไม่มีใครอยากให้เกิดขึ้น แต่หากเกิดขึ้นแล้ว ลูกจ้างควรรู้สิทธิของตนเอง...</p>",
        imageUrl: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=800",
        category: "กฎหมายแรงงาน",
        author: "ทนายสมชาย ใจดี",
        publishedAt: new Date(),
        slug: "labor-law-termination-rights",
        imageHint: "labor-law"
    },
    {
        title: "ขั้นตอนการจดทะเบียนบริษัทด้วยตัวเอง",
        description: "คู่มือฉบับสมบูรณ์สำหรับการจดทะเบียนบริษัทจำกัด ขั้นตอน เอกสารที่ต้องใช้ และค่าธรรมเนียมต่างๆ",
        content: "<p>การเริ่มต้นธุรกิจในรูปแบบนิติบุคคลช่วยสร้างความน่าเชื่อถือ...</p>",
        imageUrl: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=800",
        category: "กฎหมายธุรกิจ",
        author: "ทนายวิภา เชี่ยวชาญ",
        publishedAt: new Date(),
        slug: "company-registration-guide",
        imageHint: "business-law"
    },
    {
        title: "การทำพินัยกรรม: ทำอย่างไรให้ถูกต้องตามกฎหมาย",
        description: "เรียนรู้วิธีการทำพินัยกรรมประเภทต่างๆ และข้อควรระวังเพื่อให้พินัยกรรมมีผลบังคับใช้ได้จริง",
        content: "<p>พินัยกรรมเป็นเอกสารสำคัญที่ช่วยจัดการทรัพย์สินเมื่อเราจากไป...</p>",
        imageUrl: "https://images.unsplash.com/photo-1453928582365-b6ad33cbcf64?auto=format&fit=crop&q=80&w=800",
        category: "กฎหมายมรดก",
        author: "ทนายกานดา มั่นคง",
        publishedAt: new Date(),
        slug: "will-preparation-guide",
        imageHint: "family-law"
    },
    {
        title: "ซื้อขายที่ดินต้องรู้อะไรบ้าง?",
        description: "ข้อควรระวังและขั้นตอนการโอนกรรมสิทธิ์ที่ดิน เพื่อป้องกันการถูกโกง",
        content: "<p>การซื้อขายอสังหาริมทรัพย์มีมูลค่าสูง จึงต้องมีความรอบคอบ...</p>",
        imageUrl: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800",
        category: "กฎหมายที่ดิน",
        author: "ทนายศักดิ์สิทธิ์ จริงใจ",
        publishedAt: new Date(),
        slug: "land-purchase-guide",
        imageHint: "property-law"
    }
];

export async function seedDatabase(db: Firestore) {
    const results = {
        articles: 0,
        errors: [] as string[]
    };

    // Seed Articles
    for (const article of SAMPLE_ARTICLES) {
        try {
            await addDoc(collection(db, 'articles'), {
                ...article,
                publishedAt: Timestamp.fromDate(article.publishedAt),
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            results.articles++;
        } catch (e: any) {
            results.errors.push(`Article ${article.title}: ${e.message}`);
        }
    }

    return results;
}
