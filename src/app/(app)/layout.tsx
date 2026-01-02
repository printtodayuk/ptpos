'use client';

import React from 'react';
import Link from 'next/link';
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
import { PinLock } from '@/components/auth/pin-lock';
import { SessionProvider, useSession } from '@/components/auth/session-provider';
import { Badge } from '@/components/ui/badge';
import { WorldClock } from '@/components/dashboard/world-clock';

function AppHeader() {
  const { operator } = useSession();
  return (
    <header className="flex h-16 items-center gap-4 border-b bg-card px-4 sm:px-6">
      <SidebarTrigger className="md:hidden" />
      <div className="flex-1 flex items-center gap-4">
        <h1 className="text-lg font-semibold sm:hidden">Print Today</h1>
        <h1 className="text-lg font-semibold hidden sm:block">Print Today EPOS</h1>
        {operator && (
            <Badge variant="outline" className="text-sm">
                {operator}
            </Badge>
        )}
      </div>
      <div className="hidden md:flex items-center gap-4">
        <WorldClock city="London" timeZone="Europe/London" />
        <WorldClock city="Dhaka" timeZone="Asia/Dhaka" />
      </div>
    </header>
  );
}


export default function AppLayout({ children }: { children: React.ReactNode }) {
  
  return (
    <SessionProvider>
      <PinLock>
        <SidebarProvider>
          <div id="app-container" className="flex min-h-screen print-hide">
            <Sidebar collapsible="icon" className="border-r bg-card">
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
                 <p className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">&copy; {new Date().getFullYear()} Print Today</p>
              </SidebarFooter>
            </Sidebar>
            <SidebarInset>
              <AppHeader />
              <main className="flex-1 flex flex-col p-4 md:p-6 bg-secondary/20">
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
      </PinLock>
    </SessionProvider>
  );
}
