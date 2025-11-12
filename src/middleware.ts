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
        // Session cookie is invalid or expired.
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
    if (session) {
        requestHeaders.set('x-session-cookie', session);
    }

    const pathname = request.nextUrl.pathname;

    // Redirect unauthenticated users from protected pages to the login page
    if (!userId && !pathname.startsWith('/login') && !pathname.startsWith('/_next') && !pathname.startsWith('/api')) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Redirect authenticated users from the login page to the dashboard
    if (userId && pathname.startsWith('/login')) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|favicon.ico).*)'],
};
