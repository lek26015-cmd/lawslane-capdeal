'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Filter, MoreVertical, User, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface UserProfile {
    uid: string;
    name?: string;
    email?: string;
    photoURL?: string;
    role?: string;
    registeredAt: string;
    subscriptionStatus?: string;
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        async function fetchUsers() {
            try {
                const res = await fetch('/api/admin/users');
                if (res.ok) {
                    const data = await res.json();
                    setUsers(data.users || []);
                }
            } catch (error) {
                console.error('Failed to fetch users:', error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchUsers();
    }, []);

    const filteredUsers = users.filter(u =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.uid.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h2>
                    <p className="text-slate-500">View and manage all registered users and their permissions</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="rounded-xl border-slate-200">
                        <Filter className="w-4 h-4 mr-2" /> Filter
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 p-6">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Search users by name, email, or UID..."
                            className="pl-11 h-12 rounded-2xl bg-slate-50 border-none focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all text-base"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-20 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow className="border-none hover:bg-transparent">
                                    <TableHead className="py-4 pl-6 font-bold text-slate-500">USER</TableHead>
                                    <TableHead className="py-4 font-bold text-slate-500">UID</TableHead>
                                    <TableHead className="py-4 font-bold text-slate-500">ROLE</TableHead>
                                    <TableHead className="py-4 font-bold text-slate-500">REGISTERED</TableHead>
                                    <TableHead className="py-4 font-bold text-slate-500">SUBSCRIPTION</TableHead>
                                    <TableHead className="py-4 text-right pr-6"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.map((user) => (
                                    <TableRow key={user.uid} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="py-5 pl-6">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="w-10 h-10 border border-slate-100">
                                                    <AvatarImage src={user.photoURL} />
                                                    <AvatarFallback><User className="w-5 h-5 text-slate-400" /></AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <div className="font-bold text-slate-900">{user.name || 'Anonymous'}</div>
                                                    <div className="text-xs text-slate-500">{user.email || 'No email'}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-5">
                                            <div className="text-xs text-slate-400 font-mono">{user.uid}</div>
                                        </TableCell>
                                        <TableCell className="py-5">
                                            <Badge className={cn(
                                                "rounded-full px-3 py-1 text-xs font-bold border-none",
                                                user.role === 'admin' ? "bg-red-50 text-red-600" :
                                                    user.role === 'lawyer' ? "bg-blue-50 text-blue-600" :
                                                        "bg-slate-100 text-slate-600"
                                            )}>
                                                {user.role === 'admin' && <ShieldCheck className="w-3 h-3 mr-1 inline" />}
                                                {(user.role || 'user').toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-5 text-sm text-slate-500">
                                            {new Date(user.registeredAt).toLocaleDateString('th-TH')}
                                        </TableCell>
                                        <TableCell className="py-5">
                                            <Badge variant="outline" className="rounded-full border-slate-200 text-slate-500 font-medium">
                                                {user.subscriptionStatus || 'FREE'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-5 text-right pr-6">
                                            <Button size="icon" variant="ghost" className="rounded-full">
                                                <MoreVertical className="w-4 h-4 text-slate-400" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    {!isLoading && filteredUsers.length === 0 && (
                        <div className="p-20 text-center text-slate-500">
                            No users found matching your search.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
