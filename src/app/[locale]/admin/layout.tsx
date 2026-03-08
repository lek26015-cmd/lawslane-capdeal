'use client';

import { useUser, useFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert, LayoutDashboard, FileText, Users, Settings, LogOut, ChevronLeft, Banknote } from 'lucide-react';
import { Link, usePathname } from '@/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, isUserLoading } = useUser();
    const { firestore } = useFirebase();
    const router = useRouter();
    const pathname = usePathname();
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

    useEffect(() => {
        async function checkAdmin() {
            if (isUserLoading) return;
            if (!user) {
                router.push('/login');
                return;
            }

            // Super users or role check
            const isSuperUser = user.uid === 'N5ehLbkYXbQQLX5KEuwJbeL3cXO2' || user.uid === 'wS9w7ysNYUajNsBYZ6C7n2Afe9H3';
            if (isSuperUser) {
                setIsAdmin(true);
                return;
            }

            try {
                const userDoc = await getDoc(doc(firestore!, 'users', user.uid));
                if (userDoc.exists() && userDoc.data().role === 'admin') {
                    setIsAdmin(true);
                } else {
                    setIsAdmin(false);
                    router.push('/dashboard');
                }
            } catch (error) {
                console.error('Admin check error:', error);
                setIsAdmin(false);
                router.push('/dashboard');
            }
        }
        checkAdmin();
    }, [user, isUserLoading, firestore, router]);

    if (isUserLoading || isAdmin === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAdmin) return null;

    const navItems = [
        { icon: LayoutDashboard, label: 'Overview', href: '/admin' },
        { icon: FileText, label: 'Contracts', href: '/admin/contracts' },
        { icon: Users, label: 'Users', href: '/admin/users' },
        { icon: Banknote, label: 'Finance', href: '/admin/finance' },
        { icon: Settings, label: 'Settings', href: '/admin/settings' },
    ];

    return (
        <div className="flex min-h-screen bg-[#F8FAFC]">
            {/* Sidebar */}
            <aside className="w-72 bg-white border-r border-slate-200 hidden lg:flex flex-col sticky top-0 h-screen">
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center overflow-hidden">
                            <img src="/images/logo-lawslane-transparent-color.png" alt="Lawslane Logo" className="w-8 h-8 object-contain brightness-0 invert" />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-slate-900">CapDeal Admin</span>
                    </div>

                    <nav className="space-y-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                                        isActive
                                            ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                    )}
                                >
                                    <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-900")} />
                                    <span className="font-medium">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="mt-auto p-8 border-t border-slate-100">
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl gap-3 h-12"
                        onClick={() => router.push('/')}
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Back to Site
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-slate-900">Admin Dashboard</h2>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-slate-900">{user?.displayName || 'Admin'}</p>
                            <p className="text-xs text-slate-500">System Administrator</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200" />
                    </div>
                </header>

                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
