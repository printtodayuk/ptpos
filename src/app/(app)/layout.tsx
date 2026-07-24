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
import { FeatureProvider } from '@/components/features/feature-provider';
import { WorldClock } from '@/components/dashboard/world-clock';
import { PageTransition } from '@/components/common/page-transition';

function AppHeader() {
  const { operator } = useSession();
  return (
    <header className="glass-header sticky top-0 z-30 flex h-16 items-center gap-4 px-4 sm:px-6 shadow-sm">
      <SidebarTrigger className="md:hidden" />
      <div className="flex-1 flex items-center gap-3">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-[#012169] dark:text-indigo-400">AI Studio</span>{' '}
          <span className="text-[#C8102E] dark:text-rose-500">EPOS</span>
        </h1>
        {operator && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{operator}</span>
          </div>
        )}
      </div>
      <div className="hidden md:flex items-center gap-3">
        <WorldClock city="London" timeZone="Europe/London" />
        <WorldClock city="Dhaka" timeZone="Asia/Dhaka" />
      </div>
    </header>
  );
}


export default function AppLayout({ children }: { children: React.ReactNode }) {
  
  return (
    <SessionProvider>
      <FeatureProvider>
        <PinLock>
          <SidebarProvider defaultOpen={false}>
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
                 <p className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                   &copy; {new Date().getFullYear()}{' '}
                   <span style={{ color: '#012169', fontWeight: 600 }}>AI Studio</span>{' '}
                   <span style={{ color: '#C8102E', fontWeight: 600 }}>EPOS</span>
                 </p>
              </SidebarFooter>
            </Sidebar>
            <SidebarInset>
              <AppHeader />
              <main className="flex-1 flex flex-col p-4 md:p-6 bg-secondary/20 overflow-x-hidden">
                <PageTransition>
                  {children}
                </PageTransition>
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
      </FeatureProvider>
    </SessionProvider>
  );
}
