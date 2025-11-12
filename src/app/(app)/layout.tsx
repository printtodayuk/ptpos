'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/logo';
import { Nav } from '@/components/nav';
import { useUser } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAuth, signOut } from 'firebase/auth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const handleSignOut = () => {
    const auth = getAuth();
    signOut(auth);
  };
  
  if (isUserLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader className="p-4">
            <Link href="/dashboard" className="block group-data-[collapsible=icon]:hidden">
              <Logo />
            </Link>
             <Link href="/dashboard" className="hidden group-data-[collapsible=icon]:block">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-printer"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><path d="M18 18h-2a2 2 0 0 0-2 2v2H8v-2a2 2 0 0 0-2-2H4"/><path d="M6 18h12"/></svg>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <Nav />
          </SidebarContent>
          <SidebarFooter className="p-4 flex flex-col gap-2">
            <Button variant="outline" size="sm" onClick={handleSignOut} className="w-full group-data-[collapsible=icon]:hidden">Sign Out</Button>
             <Button variant="outline" size="icon" onClick={handleSignOut} className="hidden w-full group-data-[collapsible=icon]:block">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-log-out"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
             </Button>
            <p className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">&copy; {new Date().getFullYear()} Print Today</p>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-14 items-center gap-4 border-b bg-card px-6">
            <SidebarTrigger className="md:hidden" />
            <div className="flex-1">
              <h1 className="text-lg font-semibold">Print Today EPOS</h1>
            </div>
             <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
            </div>
          </header>
          <main className="flex-1 flex flex-col p-4 md:p-6 bg-background/50">
            {children}
          </main>
          <footer className="text-center p-4 text-xs text-muted-foreground border-t">
            Developed by{' '}
            <a
              href="mailto:info@remotizedit.com"
              className="font-medium text-primary hover:underline"
            >
              Fazle Rifat Anonto, RemotizedIT
            </a>
            .
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
