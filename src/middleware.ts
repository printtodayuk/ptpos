import { NextResponse, type NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeAdminAppSingleton } from './lib/firebase-admin';

export const runtime = 'nodejs';

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

    const pathname = request.nextUrl.pathname;

    if (!userId && !pathname.startsWith('/login') && !pathname.startsWith('/api')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    if (userId && pathname.startsWith('/login')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
}

export const config = {
  matcher: ['/((?!_next/static|favicon.ico).*)'],
};
