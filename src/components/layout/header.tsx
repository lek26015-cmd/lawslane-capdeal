'use client';

import { Link, usePathname } from '@/navigation';
import { default as NextLink } from 'next/link';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';
import { Input } from '@/components/ui/input';
import { Search, Menu, User, ChevronDown, LogOut, LayoutDashboard, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useUser as useAuthUser, useFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { doc, getDoc } from 'firebase/firestore';
import profileLawyerImg from '@/pic/profile-lawyer.jpg';

import { getMainLink, getBusinessLink } from '@/lib/domain-utils';


export default function Header({ setUserRole, domainType = 'main' }: { setUserRole: (role: string | null) => void; domainType?: 'main' | 'lawyer' | 'admin' | 'business' }) {
  const t = useTranslations('Navigation');
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { auth, firestore } = useFirebase();
  const { user, isUserLoading: isLoading } = useAuthUser();

  const isSuperUser = user && (user.uid === 'N5ehLbkYXbQQLX5KEuwJbeL3cXO2' || user.uid === 'wS9w7ysNYUajNsBYZ6C7n2Afe9H3');
  const [role, setRole] = useState<string | null>(null);
  const isAdmin = role === 'admin' || isSuperUser;
  const isLawyer = role === 'lawyer' || isSuperUser;

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRole() {
      if (!user || !firestore) return;

      try {
        // 1. Check Lawyer Profile FIRST (Priority)
        const lawyerDocRef = doc(firestore, "lawyerProfiles", user.uid);
        const lawyerSnap = await getDoc(lawyerDocRef);

        // Hotfix for specific user
        if (lawyerSnap.exists() || user.uid === 'N5ehLbkYXbQQLX5KEuwJbeL3cXO2' || user.uid === 'wS9w7ysNYUajNsBYZ6C7n2Afe9H3') {
          console.log("User is a lawyer:", user.uid);
          setRole('lawyer');
          setUserRole('lawyer');
          setAvatarUrl(lawyerSnap.exists() ? lawyerSnap.data().imageUrl : user.photoURL);
          return; // Exit early if lawyer
        }

        // 2. Check User Profile
        const userDocRef = doc(firestore, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          console.log("User is a regular user:", data.role);
          setRole(data.role || 'user');
          setUserRole(data.role || 'user');
          setAvatarUrl(data.avatar || user.photoURL);
        } else {
          // No profile found
          setRole('user');
          setUserRole('user');
          setAvatarUrl(user.photoURL);
        }

      } catch (error) {
        console.error("Error fetching role:", error);
      }
    }

    if (!isLoading) {
      fetchRole();
    }
  }, [user, isLoading, firestore, setUserRole]);

  // Home page detection that handles locales
  const isHomePage = pathname === '/' || pathname === '/th' || pathname === '/en' || pathname === '/zh' ||
    pathname === '/th/' || pathname === '/en/' || pathname === '/zh/';

  useEffect(() => {
    if (!isHomePage) {
      if (!isScrolled) setIsScrolled(true);
      return;
    }

    const handleScroll = () => {
      const scrolled = window.scrollY > 50;
      setIsScrolled(scrolled);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isHomePage, isScrolled]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname])

  // Ensure header is transparent on home page before scrolling
  const useTransparentHeader = isHomePage && !isScrolled;

  const { toast } = useToast();

  const handleLogout = async () => {
    if (auth) {
      try {
        await fetch('/api/auth/session', { method: 'DELETE' });
      } catch (err) {
        console.error("Failed to clear session cookie:", err);
      }
      await signOut(auth);
      toast({
        title: "ออกจากระบบแล้ว!",
        description: "คุณได้ออกจากระบบเรียบร้อยแล้ว",
      });
      // Force redirect to login page after logout
      window.location.href = '/';
    }
  }

  const headerClasses = cn(
    'w-full transition-all duration-300 z-50',
    useTransparentHeader
      ? 'absolute top-0 bg-transparent text-white border-transparent'
      : 'sticky top-0 bg-[#0B1527] text-white border-slate-800 shadow-sm border-b'
  );

  const navLinkClasses = cn(
    'transition-colors font-medium leading-none hover:text-blue-400',
    'text-white/80'
  );

  const activeNavLinkClasses = cn(
    'font-bold text-white'
  );

  const loginButtonClasses = cn(
    'text-white hover:text-blue-400 hover:bg-white/10'
  );

  return (
    <header className={headerClasses}>
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        <Logo
          href={getMainLink('/', domainType, !isMounted)}
          variant="white"
          className="text-white"
          subtitle="by Lawslane"
          showText={true}
        />

        <div className="hidden xl:flex items-center gap-6">
          <nav className="flex items-center gap-6 text-[15px] font-medium whitespace-nowrap">
            <a href="https://lawslane.com" target="_blank" rel="noopener noreferrer" className={navLinkClasses}>
              {t('backToMain')}
            </a>
            <Link href={getMainLink('/about', domainType)} className={pathname.startsWith(`/about`) ? activeNavLinkClasses : navLinkClasses}>
              {t('about')}
            </Link>
            <Link href={getMainLink('/services', domainType)} className={pathname.startsWith(`/services`) ? activeNavLinkClasses : navLinkClasses}>
              {t('services')}
            </Link>

            {/* Search Lawyer with Icon */}
            <Link href={getMainLink('/find-lawyer', domainType)} className={cn("flex items-center gap-2", navLinkClasses)}>
              <Search className="h-5 w-5 stroke-[2.5]" />
              <span>{t('findLawyer')}</span>
            </Link>

            {/* Vertical Divider */}
            <div className="h-6 w-px bg-slate-700 mx-1" />

            <div className="flex items-center gap-4">
              <LanguageSwitcher
                className={cn(
                  "h-10 px-4 rounded-full border border-slate-700 bg-white/5 hover:bg-white/10 transition-all",
                  "text-white text-sm font-semibold"
                )}
                iconClassName="text-white"
              />

              {/* Vertical Divider */}
              <div className="h-6 w-px bg-slate-700 mx-1" />

              {isLoading ? null : user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className={cn("flex items-center gap-2 h-11 px-4 rounded-xl", loginButtonClasses)}>
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={avatarUrl || profileLawyerImg.src} />
                        <AvatarFallback>{user.displayName?.charAt(0) || user.email?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="hidden lg:inline">{user.displayName || user.email}</span>
                      <ChevronDown className="w-4 h-4 ml-1 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[220px] bg-white border-slate-100 rounded-2xl shadow-2xl p-2">
                    <DropdownMenuLabel className="px-3 pb-2 pt-1">
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{t('myAccount')}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-50" />

                    {isAdmin && (
                      <DropdownMenuItem asChild className="rounded-lg py-2.5">
                        <Link href="/admin" className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                            <LayoutDashboard className="w-4 h-4" />
                          </div>
                          <span>{t('adminDashboard')}</span>
                        </Link>
                      </DropdownMenuItem>
                    )}

                    {(isLawyer || isSuperUser) && (
                      <DropdownMenuItem asChild className="rounded-lg py-2.5">
                        <NextLink href="/lawyer-dashboard" className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                            <LayoutDashboard className="w-4 h-4" />
                          </div>
                          <span>{t('dashboard')}</span>
                        </NextLink>
                      </DropdownMenuItem>
                    )}

                    {(!isAdmin && !isLawyer || isSuperUser) && (
                      <DropdownMenuItem asChild className="rounded-lg py-2.5">
                        <Link href="/dashboard" className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <LayoutDashboard className="w-4 h-4" />
                          </div>
                          <span>{t('dashboard')}</span>
                        </Link>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem asChild className="rounded-lg py-2.5">
                      <Link href="/account" className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600">
                          <User className="w-4 h-4" />
                        </div>
                        <span>{t('manageAccount')}</span>
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="bg-slate-50" />

                    <DropdownMenuItem onClick={handleLogout} className="rounded-lg py-2.5 text-red-600 focus:bg-red-50 focus:text-red-700">
                      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                        <LogOut className="w-4 h-4" />
                      </div>
                      <span className="font-medium">{t('logout')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link href="/login">
                  <Button className={cn(
                    "flex items-center gap-3 h-11 px-6 rounded-2xl border border-slate-700 bg-white/5 hover:bg-white/10 transition-all text-white font-bold",
                    "shadow-sm hover:shadow-md"
                  )}>
                    <LogOut className="h-5 w-5 transform rotate-180" />
                    <span>{t('login')}</span>
                  </Button>
                </Link>
              )}
            </div>
          </nav>
        </div>

        {/* Mobile View remains largely same but updated with colors */}
        <div className="flex items-center gap-2 xl:hidden">
          <div className="transition-all duration-300 ease-in-out mr-1 text-white">
            <LanguageSwitcher
              className="h-9 px-3 text-xs flex items-center rounded-full border border-slate-700 bg-white/10"
              iconClassName="text-white"
            />
          </div>
          {user ? (
            <Link href="/account">
              <Avatar className="w-8 h-8 border border-white/20">
                <AvatarImage src={avatarUrl || profileLawyerImg.src} />
                <AvatarFallback>{user.displayName?.charAt(0) || user.email?.charAt(0)}</AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full">
                <User className="w-5 h-5" />
              </Button>
            </Link>
          )}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 flex flex-col h-full bg-[#0B1527] border-slate-800 text-white">
              <SheetHeader className="p-6 pb-0">
                <SheetTitle>
                  <Logo
                    href={getMainLink('/', domainType, !isMounted)}
                    variant="white"
                    subtitle="by Lawslane"
                  />
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-6 p-6 overflow-y-auto flex-1">
                <nav className="flex flex-col gap-4 text-lg mt-6">
                  <a href="https://lawslane.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">{t('backToMain')}</a>
                  <Link href={getMainLink('/', domainType, !isMounted)} className="hover:text-blue-400">{t('home')}</Link>
                  <Link href={getMainLink('/about', domainType)} className="hover:text-blue-400">{t('about')}</Link>
                  <Link href={getMainLink('/services', domainType)} className="hover:text-blue-400">{t('services')}</Link>
                  <Link href={getMainLink('/find-lawyer', domainType)} className="flex items-center gap-2 hover:text-blue-400">
                    <Search className="h-5 w-5" />{t('findLawyer')}
                  </Link>
                </nav>
                <div className="border-t border-slate-800 pt-6 mt-auto">
                  {user ? (
                    <div className="space-y-4">
                      {/* User dropdown content but vertical */}
                    </div>
                  ) : (
                    <Link href="/login" className="block">
                      <Button className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">{t('login')}</Button>
                    </Link>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
