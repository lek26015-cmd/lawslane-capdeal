'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight, Banknote, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface Transaction {
    id: string;
    type: string;
    amount: number;
    status: string;
    customer: string;
    title: string;
    date: string;
}

interface ChartItem {
    date: string;
    amount: number;
}

export default function AdminFinancePage() {
    const [data, setData] = useState<{ transactions: Transaction[], chartData: ChartItem[], summary: any } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchFinance() {
            try {
                const res = await fetch('/api/admin/finance');
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (error) {
                console.error('Failed to fetch finance data:', error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchFinance();
    }, []);

    if (isLoading) {
        return (
            <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Financial Overview</h2>
                    <p className="text-slate-500">Track revenue and transactions for Cap and Deal</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="rounded-xl border-slate-200">
                        <Calendar className="w-4 h-4 mr-2" /> Last 30 Days
                    </Button>
                    <Button className="rounded-xl bg-slate-900 text-white">
                        Export Report
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-sm rounded-3xl p-6 bg-slate-900 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-white/10 rounded-2xl">
                            <DollarSign className="w-6 h-6 text-white" />
                        </div>
                        <div className={cn(
                            "flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full",
                            data?.summary?.revenueTrend?.startsWith('-') ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
                        )}>
                            {data?.summary?.revenueTrend?.startsWith('-') ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                            {data?.summary?.revenueTrend || '+0%'}
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-400 mb-1">Total Revenue</p>
                        <p className="text-3xl font-bold tracking-tight">฿{(data?.summary?.totalRevenue || 0).toLocaleString()}</p>
                    </div>
                </Card>

                <Card className="border-none shadow-sm rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-50 rounded-2xl">
                            <Banknote className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 mb-1">Total Transactions</p>
                        <p className="text-3xl font-bold text-slate-900 tracking-tight">{data?.summary?.transactionCount || 0}</p>
                    </div>
                </Card>

                <Card className="border-none shadow-sm rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-50 rounded-2xl">
                            <TrendingUp className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 mb-1">Avg. Transaction Value</p>
                        <p className="text-3xl font-bold text-slate-900 tracking-tight">
                            ฿{Math.round((data?.summary?.totalRevenue || 0) / (data?.summary?.transactionCount || 1)).toLocaleString()}
                        </p>
                    </div>
                </Card>
            </div>

            {/* Revenue Chart */}
            <Card className="border-none shadow-sm rounded-3xl p-6">
                <CardHeader className="px-0 pt-0">
                    <CardTitle className="text-lg font-bold">Revenue Trends</CardTitle>
                    <CardDescription>Daily revenue for the last 30 days</CardDescription>
                </CardHeader>
                <CardContent className="px-0 pt-6 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data?.chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                tickFormatter={(str) => new Date(str).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                tickFormatter={(val) => `฿${val.toLocaleString()}`}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                formatter={(val: number) => [`฿${val.toLocaleString()}`, 'Revenue']}
                            />
                            <Line
                                type="monotone"
                                dataKey="amount"
                                stroke="#0f172a"
                                strokeWidth={3}
                                dot={{ fill: '#0f172a', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="p-6 border-b border-slate-100">
                    <CardTitle className="text-lg font-bold">Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow className="border-none hover:bg-transparent">
                                <TableHead className="py-4 pl-6 font-bold text-slate-500">TRANSACTION</TableHead>
                                <TableHead className="py-4 font-bold text-slate-500">CUSTOMER</TableHead>
                                <TableHead className="py-4 font-bold text-slate-500">AMOUNT</TableHead>
                                <TableHead className="py-4 font-bold text-slate-500">DATE</TableHead>
                                <TableHead className="py-4 font-bold text-slate-500">STATUS</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data?.transactions.map((tx) => (
                                <TableRow key={tx.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <TableCell className="py-5 pl-6">
                                        <div className="font-bold text-slate-900">{tx.title}</div>
                                        <div className="text-xs text-slate-400 font-mono mt-0.5">{tx.id}</div>
                                    </TableCell>
                                    <TableCell className="py-5">
                                        <div className="text-xs text-slate-500 font-mono line-clamp-1 max-w-[150px]">{tx.customer}</div>
                                    </TableCell>
                                    <TableCell className="py-5 font-bold text-slate-900">
                                        ฿{tx.amount.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="py-5 text-sm text-slate-500">
                                        {new Date(tx.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </TableCell>
                                    <TableCell className="py-5">
                                        <Badge className="bg-emerald-50 text-emerald-600 rounded-full px-3 py-1 text-xs font-bold border-none">
                                            {tx.status.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {data?.transactions.length === 0 && (
                        <div className="p-20 text-center text-slate-500"> No transactions found. </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
