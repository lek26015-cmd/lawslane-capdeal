import { headers } from 'next/headers';
import { initAdmin } from './firebase-admin';

export async function verifyAdmin() {
    try {
        const headersList = await headers();
        const authHeader = headersList.get('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { error: 'Unauthorized: Missing token', status: 401 };
        }

        const token = authHeader.split('Bearer ')[1];
        const adminApp = await initAdmin();
        if (!adminApp) return { error: 'Failed to initialize admin', status: 500 };

        // Verify the ID token
        let decodedToken;
        try {
            decodedToken = await adminApp.auth().verifyIdToken(token);
        } catch (error) {
            return { error: 'Unauthorized: Invalid token', status: 401 };
        }

        // Check for admin role (consistent with AdminLayout)
        const isSuperUser = decodedToken.uid === 'N5ehLbkYXbQQLX5KEuwJbeL3cXO2' || decodedToken.uid === 'wS9w7ysNYUajNsBYZ6C7n2Afe9H3';
        const isAdmin = isSuperUser || decodedToken.email === 'lek.26015@gmail.com' || decodedToken.role === 'admin';

        if (!isAdmin) {
            return { error: 'Forbidden: Admin access required', status: 403 };
        }

        return { adminApp, decodedToken, isAdmin: true };
    } catch (error: any) {
        console.error('VERIFY_ADMIN_ERROR', error);
        return { error: error.message, status: 500 };
    }
}
