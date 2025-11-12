import { NextResponse, type NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeAdminAppSingleton } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    const idToken = await request.json();

    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    
    try {
        const adminApp = initializeAdminAppSingleton();
        const adminAuth = getAuth(adminApp);
        const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
        
        const options = {
            name: '__session',
            value: sessionCookie,
            maxAge: expiresIn,
            httpOnly: true,
            secure: true,
        };

        const response = NextResponse.json({ status: 'success' });
        response.cookies.set(options);
        return response;

    } catch (error) {
        console.error('Error creating session cookie:', error);
        return NextResponse.json({ status: 'error' }, { status: 401 });
    }
}
