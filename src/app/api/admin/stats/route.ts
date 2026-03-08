import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';

export async function GET() {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) {
            return NextResponse.json({ error: 'Failed to initialize admin' }, { status: 500 });
        }

        const db = adminApp.firestore();
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        // Parallelize all necessary queries
        const [
            totalUsersCount,
            recentUsersCount,
            prevUsersCount,
            totalContractsCount,
            recentContractsCount,
            prevContractsCount,
            paymentsSnap,
            activeSubsCount
        ] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('users').where('createdAt', '>=', thirtyDaysAgo).count().get(),
            db.collection('users').where('createdAt', '>=', sixtyDaysAgo).where('createdAt', '<', thirtyDaysAgo).count().get(),
            db.collection('contracts').count().get(),
            db.collection('contracts').where('createdAt', '>=', thirtyDaysAgo).count().get(),
            db.collection('contracts').where('createdAt', '>=', sixtyDaysAgo).where('createdAt', '<', thirtyDaysAgo).count().get(),
            db.collection('payments').where('status', '==', 'succeeded').get(),
            db.collection('users').where('subscriptionStatus', '==', 'active').count().get()
        ]);

        const totalUsers = totalUsersCount.data().count;
        const totalContracts = totalContractsCount.data().count;
        const activeSubscriptions = activeSubsCount.data().count;

        // Calculate Revenue
        let totalRevenue = 0;
        let recentRevenue = 0;
        let prevRevenue = 0;

        paymentsSnap.forEach(doc => {
            const data = doc.data();
            const amount = data.amount || 0;
            const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt || 0);

            totalRevenue += amount;
            if (createdAt >= thirtyDaysAgo) {
                recentRevenue += amount;
            } else if (createdAt >= sixtyDaysAgo) {
                prevRevenue += amount;
            }
        });

        // Helper to calculate percentage trend
        const calculateTrend = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? '+100%' : '0%';
            const change = ((current - previous) / previous) * 100;
            return (change >= 0 ? '+' : '') + change.toFixed(0) + '%';
        };

        return NextResponse.json({
            totalUsers,
            usersTrend: calculateTrend(recentUsersCount.data().count, prevUsersCount.data().count),
            totalContracts,
            contractsTrend: calculateTrend(recentContractsCount.data().count, prevContractsCount.data().count),
            totalRevenue: totalRevenue / 100,
            revenueTrend: calculateTrend(recentRevenue, prevRevenue),
            activeSubPercentage: totalUsers > 0 ? Math.round((activeSubscriptions / totalUsers) * 100) : 0,
            activeSubTrend: '+0%' // Static for now as we don't have historical sub counts easily
        });
    } catch (error: any) {
        console.error('ADMIN_STATS_ERROR', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
