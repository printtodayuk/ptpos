
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
    <SidebarMenu>
      {visibleNavItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} onClick={handleLinkClick}>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href}
              className={cn(pathname === item.href && 'bg-primary/10 text-primary')}
              tooltip={item.label}
            >
              <div>
                <item.icon />
                <span>{item.label}</span>
              </div>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
       <SidebarMenuItem>
          <SidebarMenuButton onClick={logout} className="mt-4" tooltip={`Logout ${operator || ''}`}>
            <>
              <LogOut />
              <span>Logout</span>
            </>
          </SidebarMenuButton>
        </SidebarMenuItem>
    </SidebarMenu>
  );
}

    