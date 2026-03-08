'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, FileText, DollarSign, TrendingUp, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Stats {
    totalUsers: number;
    totalContracts: number;
    totalRevenue: number;
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const [statsRes, activityRes] = await Promise.all([
                    fetch('/api/admin/stats'),
                    fetch('/api/admin/activity')
                ]);

                if (statsRes.ok) {
                    const statsData = await statsRes.ok ? await statsRes.json() : null;
                    setStats(statsData);
                }

                if (activityRes.ok) {
                    const activityData = await activityRes.json();
                    setActivities(activityData.activities || []);
                }
            } catch (error) {
                console.error('Failed to fetch admin data:', error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    if (isLoading) {
        return (
            <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    const cards = [
        {
            title: 'Total Users',
            value: stats?.totalUsers || 0,
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            trend: stats?.usersTrend || '+0%',
            trendUp: !stats?.usersTrend?.startsWith('-')
        },
        {
            title: 'Total Contracts',
            value: stats?.totalContracts || 0,
            icon: FileText,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
            trend: stats?.contractsTrend || '+0%',
            trendUp: !stats?.contractsTrend?.startsWith('-')
        },
        {
            title: 'Total Revenue',
            value: `฿${(stats?.totalRevenue || 0).toLocaleString()}`,
            icon: DollarSign,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            trend: stats?.revenueTrend || '+0%',
            trendUp: !stats?.revenueTrend?.startsWith('-')
        },
        {
            title: 'Active Subscription',
            value: `${stats?.activeSubPercentage || 0}%`,
            icon: TrendingUp,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            trend: stats?.activeSubTrend || '+0%',
            trendUp: true
        }
    ];

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, i) => (
                    <Card key={i} className="border-none shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-all duration-300">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className={cn("p-3 rounded-2xl", card.bg)}>
                                    <card.icon className={cn("w-6 h-6", card.color)} />
                                </div>
                                <div className={cn(
                                    "flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full",
                                    card.trendUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                )}>
                                    {card.trendUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                    {card.trend}
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500 mb-1">{card.title}</p>
                                <p className="text-3xl font-bold text-slate-900 tracking-tight">{card.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl p-6">
                    <CardHeader className="px-0 pt-0">
                        <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
                        <CardDescription>Real-time system events and updates</CardDescription>
                    </CardHeader>
                    <CardContent className="px-0 pt-4">
                        <div className="space-y-6">
                            {activities.length > 0 ? activities.map((activity, i) => (
                                <div key={i} className="flex items-start gap-4">
                                    <div className={cn(
                                        "w-2 h-2 mt-2 rounded-full shrink-0",
                                        activity.category === 'Users' ? "bg-blue-500" :
                                            activity.category === 'Contracts' ? "bg-purple-500" : "bg-emerald-500"
                                    )} />
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{activity.title}</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {formatTimeAgo(activity.timestamp)} • {activity.category}
                                        </p>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-sm text-slate-500 text-center py-10">No recent activity found.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm rounded-3xl p-6">
                    <CardHeader className="px-0 pt-0">
                        <CardTitle className="text-lg font-bold">Quick Actions</CardTitle>
                        <CardDescription>System management tools</CardDescription>
                    </CardHeader>
                    <CardContent className="px-0 pt-4 flex flex-col gap-3">
                        <Button className="w-full justify-start rounded-xl h-12 bg-slate-100 text-slate-900 hover:bg-slate-200 border-none transition-all">
                            Export User Data
                        </Button>
                        <Button className="w-full justify-start rounded-xl h-12 bg-slate-100 text-slate-900 hover:bg-slate-200 border-none transition-all">
                            Send System Notification
                        </Button>
                        <Button className="w-full justify-start rounded-xl h-12 bg-red-50 text-red-600 hover:bg-red-100 border-none transition-all">
                            System Maintenance Mode
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Helper function for relative time
function formatTimeAgo(dateStr: string) {
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
}

// Helper function for class names
function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
