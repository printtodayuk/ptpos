import { NextResponse, type NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeAdminAppSingleton } from './lib/firebase-admin';

async function getUserIdFromSession(session: string | undefined) {
    if (!session) return null;
    try {
        const adminApp = initializeAdminAppSingleton();
        const adminAuth = getAuth(adminApp);
        const decodedIdToken = await adminAuth.verifySessionCookie(session, true);
        return decodedIdToken.uid;
    } catch (error) {
        console.error('Error verifying session cookie:', error);
        return null;
    }
}

export async function middleware(request: NextRequest) {
    const session = request.cookies.get('__session')?.value;
    const userId = await getUserIdFromSession(session);
    
    const requestHeaders = new Headers(request.headers);
    if (userId) {
        requestHeaders.set('x-user-id', userId);
    }

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
}

export const config = {
  matcher: ['/((?!_next/static|favicon.ico|login|manifest.json).*)'],
};
