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

export const SAMPLE_LAWYERS = [
    {
        name: "ทนายสมชาย ใจดี",
        email: "somchai@example.com",
        phone: "081-234-5678",
        specialties: ["กฎหมายแรงงาน", "กฎหมายแพ่ง"],
        bio: "ทนายความผู้มีประสบการณ์ว่าความคดีแรงงานมากว่า 10 ปี ยินดีให้คำปรึกษาทุกปัญหาแรงงาน",
        experience: 10,
        education: "นิติศาสตรบัณฑิต มหาวิทยาลัยธรรมศาสตร์",
        licenseNumber: "1234/2555",
        province: "กรุงเทพมหานคร",
        imageUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=800",
        imageHint: "lawyer-male",
        status: "approved",
        rating: 4.8,
        reviewCount: 15,
        pricing: {
            appointmentFee: 3500,
            chatFee: 500
        },
        joinedAt: new Date()
    },
    {
        name: "ทนายวิภา เชี่ยวชาญ",
        email: "wipa@example.com",
        phone: "089-876-5432",
        specialties: ["กฎหมายธุรกิจ", "ทรัพย์สินทางปัญญา"],
        bio: "เชี่ยวชาญด้านการจดทะเบียนบริษัทและเครื่องหมายการค้า ให้คำปรึกษาธุรกิจ SME มาแล้วกว่า 100 ราย",
        experience: 8,
        education: "นิติศาสตรมหาบัณฑิต จุฬาลงกรณ์มหาวิทยาลัย",
        licenseNumber: "5678/2558",
        province: "นนทบุรี",
        imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=800",
        imageHint: "lawyer-female",
        status: "approved",
        rating: 4.9,
        reviewCount: 22,
        pricing: {
            appointmentFee: 4000,
            chatFee: 600
        },
        joinedAt: new Date()
    },
    {
        name: "ทนายกานดา มั่นคง",
        email: "kanda@example.com",
        phone: "086-111-2222",
        specialties: ["กฎหมายครอบครัว", "มรดก"],
        bio: "เข้าใจทุกปัญหาครอบครัว พร้อมดูแลด้วยความใส่ใจ รับทำพินัยกรรมและจัดการมรดก",
        experience: 12,
        education: "นิติศาสตรบัณฑิต มหาวิทยาลัยรามคำแหง",
        licenseNumber: "9012/2553",
        province: "เชียงใหม่",
        imageUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=800",
        imageHint: "lawyer-female-2",
        status: "approved",
        rating: 5.0,
        reviewCount: 30,
        pricing: {
            appointmentFee: 3000,
            chatFee: 500
        },
        joinedAt: new Date()
    }
];

export async function seedDatabase(db: Firestore) {
    const results = {
        articles: 0,
        lawyers: 0,
        errors: [] as string[]
    };

    // Seed Articles
    for (const article of SAMPLE_ARTICLES) {
        try {
            // Check if slug exists to avoid duplicates (simple check)
            // ideally we query, but for seed we can just addDoc or setDoc with slug as ID if we wanted.
            // Let's just use addDoc for simplicity.
            await addDoc(collection(db, 'articles'), {
                ...article,
                publishedAt: Timestamp.fromDate(article.publishedAt),
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            results.articles++;
        } catch (e: any) {
            console.error("Error seeding article:", e);
            results.errors.push(`Article ${article.title}: ${e.message}`);
        }
    }

    // Seed Lawyers
    for (const lawyer of SAMPLE_LAWYERS) {
        try {
            // We'll use addDoc, but in reality lawyer ID usually comes from Auth UID.
            // For display purposes on homepage, random ID is fine.
            // But if we want to login as them, we need real Auth users.
            // This seed is just for "Display" purposes.
            await addDoc(collection(db, 'lawyerProfiles'), {
                ...lawyer,
                joinedAt: Timestamp.fromDate(lawyer.joinedAt),
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            results.lawyers++;
        } catch (e: any) {
            console.error("Error seeding lawyer:", e);
            results.errors.push(`Lawyer ${lawyer.name}: ${e.message}`);
        }
    }

    return results;
}
