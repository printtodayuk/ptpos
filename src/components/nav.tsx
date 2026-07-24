
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  File,
  BarChart4,
  UserCheck,
  ClipboardList,
  Contact,
  FileSpreadsheet,
  Clock,
  Briefcase,
  Users,
  LogOut,
  MessageSquareQuote,
} from 'lucide-react';
import React from 'react';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { useSession } from './auth/session-provider';
import { useFeatures } from '@/components/features/feature-provider';
import { AppFeatures } from '@/lib/types';

type NavItem = {
  href: string;
  icon: any;
  label: string;
  featureKey?: keyof AppFeatures;
};

const navItems: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/job-sheet', icon: ClipboardList, label: 'Job Sheet', featureKey: 'createJobSheet' },
  { href: '/js-report', icon: FileSpreadsheet, label: 'JS Report', featureKey: 'reports' },
  { href: '/quotation', icon: MessageSquareQuote, label: 'Quotation', featureKey: 'createQuotation' },
  { href: '/quotation-report', icon: FileText, label: 'Quotation Report', featureKey: 'reports' },
  { href: '/invoice-generator', icon: FileText, label: 'Invoice Generator', featureKey: 'createInvoice' },
  { href: '/non-invoicing', icon: File, label: 'PT Till', featureKey: 'transactions' },
  { href: '/contact-list', icon: Contact, label: 'Contact List', featureKey: 'manageContacts' },
  { href: '/attendance', icon: Clock, label: 'Attendance', featureKey: 'attendance' },
  { href: '/attendance-report', icon: Briefcase, label: 'Time Report', featureKey: 'reports' },
  { href: '/reporting', icon: BarChart4, label: 'Transactions', featureKey: 'transactions' },
  { href: '/admin', icon: UserCheck, label: 'Admin' },
  { href: '/admin-time', icon: Users, label: 'Admin-Time' },
];

export function Nav() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  const { logout, operator } = useSession();

  const { features } = useFeatures();

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  const visibleNavItems = navItems.filter((item) => {
    if (!item.featureKey) return true;
    return features[item.featureKey];
  });

  return (
    <SidebarMenu className="gap-1 px-2 py-2">
      {visibleNavItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href} onClick={handleLinkClick} className="w-full">
              <SidebarMenuButton
                asChild
                isActive={isActive}
                className={cn(
                  'h-10 rounded-xl transition-all duration-200 group font-medium text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-primary/5',
                  isActive && 'bg-primary/10 text-primary font-bold shadow-sm border-l-4 border-primary rounded-l-none'
                )}
                tooltip={item.label}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn('h-4 w-4 transition-transform duration-200 group-hover:scale-110', isActive && 'text-primary')} />
                  <span className="text-sm">{item.label}</span>
                </div>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        );
      })}
      <SidebarMenuItem className="mt-4 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
        <SidebarMenuButton 
          onClick={logout} 
          className="h-10 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 font-semibold transition-all duration-200" 
          tooltip={`Logout ${operator || ''}`}
        >
          <div className="flex items-center gap-3">
            <LogOut className="h-4 w-4" />
            <span className="text-sm">Logout</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

    