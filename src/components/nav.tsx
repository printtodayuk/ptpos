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
} from 'lucide-react';
import React from 'react';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/job-sheet', icon: ClipboardList, label: 'Job Sheet' },
  { href: '/js-report', icon: FileSpreadsheet, label: 'JS Report' },
  { href: '/non-invoicing', icon: File, label: 'PT Till' },
  { href: '/contact-list', icon: Contact, label: 'Contact List' },
  { href: '/reporting', icon: BarChart4, label: 'Reporting' },
  { href: '/admin', icon: UserCheck, label: 'Admin' },
];

export function Nav() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  return (
    <SidebarMenu>
      {navItems.map((item) => (
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
    </SidebarMenu>
  );
}
