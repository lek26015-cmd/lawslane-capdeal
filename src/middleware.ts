import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

const intlMiddleware = createMiddleware({
    // A list of all locales that are supported
    locales: ['th', 'en', 'zh'],

    // Used when no locale matches
    defaultLocale: 'th'
});

export default async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const hostname = request.headers.get('host');

    // 0. Subdomain Routing — business.* ถูกปลดระวางแล้ว ชี้ไปหน้า coming-soon
    //    (เดิมมีตรรกะเช็ค session อยู่เหนือบรรทัด rewrite แต่เป็น dead code ทั้งก้อน
    //     เพราะ rewrite ทำงานทุกกรณีอยู่ดี — รวมถึง "B2B AUTH BYPASS (DEV)" ที่ถูกลบแล้ว)
    if (hostname?.startsWith('business.')) {
        const localeMatch = pathname.match(/^\/(th|en|zh)(\/|$)/);
        const locale = localeMatch ? localeMatch[1] : 'th';
        return NextResponse.rewrite(new URL(`/${locale}/coming-soon`, request.url));
    }

    // 1. /dashboard/b2b และ /b2b บนโดเมนหลัก -> coming-soon
    //    ต้องมาก่อนการเช็ค session ด้านล่าง เพราะ path มีคำว่า /dashboard อยู่ด้วย
    if (pathname.includes('/dashboard/b2b') || pathname.match(/^\/(th|en|zh)?\/b2b/)) {
        const localeMatch = pathname.match(/^\/(th|en|zh)(\/|$)/);
        const locale = localeMatch ? localeMatch[1] : 'th';
        return NextResponse.redirect(new URL(`/${locale}/coming-soon`, request.url));
    }

    // 2. กันหน้าที่ต้องล็อกอินบนโดเมน capdeal เอง
    //    ⚠️ นี่เป็นแค่ UX redirect ไม่ใช่ด่านความปลอดภัย — middleware รันบน Edge
    //    จึง verify Firebase session cookie ไม่ได้ (ต้องใช้ Admin SDK)
    //    ด่านจริงอยู่ที่ requireUser() ใน API route และ server action ทุกตัว
    const protectedPaths = ['/dashboard', '/clm', '/admin', '/account'];
    const isProtected = protectedPaths.some((p) => pathname.includes(p))
        && !pathname.includes('/login')
        && !pathname.includes('/signup');

    if (isProtected && !request.cookies.has('session')) {
        const localeMatch = pathname.match(/^\/(th|en|zh)(\/|$)/);
        const locale = localeMatch ? localeMatch[1] : 'th';
        const searchParams = new URLSearchParams();
        searchParams.set('redirect', pathname);
        return NextResponse.redirect(new URL(`/${locale}/login?${searchParams.toString()}`, request.url));
    }

    // 3. Internationalization Middleware
    const response = intlMiddleware(request);

    // Add Security Headers
    // same-origin-allow-popups ยังให้ signInWithPopup ของ Firebase ทำงานได้
    // แต่ไม่เปิดช่องให้หน้าต่างอื่นอ้างอิงถึงกันแบบ unsafe-none
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

    return response;
}

export const config = {
    // Match all pathnames except for:
    // - /api, /_next, /_vercel (system routes)
    // - Files with extensions (e.g. favicon.ico)
    matcher: ['/((?!api|_next|_vercel|.*\\..*).*)', '/']
};
