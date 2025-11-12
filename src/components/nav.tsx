'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  File,
  BarChart4,
  UserCheck,
} from 'lucide-react';
import React from 'react';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/invoicing', icon: FileText, label: 'Invoicing' },
  { href: '/non-invoicing', icon: File, label: 'Non-Invoicing' },
  { href: '/reporting', icon: BarChart4, label: 'Reporting' },
  { href: '/admin', icon: UserCheck, label: 'Admin' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href}>
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
