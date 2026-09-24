'use client';

import { useEffect, useState, useMemo } from 'react';
import { getTillStats } from '@/lib/server-actions';
import { StatCard } from '@/components/dashboard/stat-card';
import { Banknote, CalendarDays, CreditCard, Landmark, Building2, Plane } from 'lucide-react';
import type { Transaction } from '@/lib/types';

interface TillStatsProps {
  transactions?: Transaction[];
  loading?: boolean;
  dateLabel?: string;
}

export function TillStats({ transactions, loading, dateLabel = "Selected Day" }: TillStatsProps) {
  const [serverStats, setServerStats] = useState<{
    dailySales: number;
    cashTotal: number;
    cardTotal: number;
    bankTotal: number;
  } | null>(null);
  const [isServerLoading, setIsServerLoading] = useState(false);

  useEffect(() => {
    if (!transactions) {
      setIsServerLoading(true);
      getTillStats().then(data => {
        if (data.success) {
          setServerStats({
            dailySales: data.dailySales,
            cashTotal: data.cashTotal,
            cardTotal: data.cardTotal,
            bankTotal: data.bankTotal,
          });
        }
        setIsServerLoading(false);
      });
    }
  }, [transactions]);

  // Derived real-time stats from the day's transactions
  const stats = useMemo(() => {
    if (!transactions) return null;

    let totalSales = 0;
    let cashTotal = 0;
    let cashCount = 0;
    let cardTotal = 0;
    let cardCount = 0;
    let bankTotal = 0;
    let bankCount = 0;
    let stTotal = 0;
    let stCount = 0;
    let airTotal = 0;
    let airCount = 0;

    transactions.forEach(t => {
      const amount = Number(t.paidAmount) || Number(t.totalAmount) || 0;
      totalSales += amount;

      if (t.paymentMethod === 'Cash') {
        cashTotal += amount;
        cashCount += 1;
      } else if (t.paymentMethod === 'Card Payment') {
        cardTotal += amount;
        cardCount += 1;
      } else if (t.paymentMethod === 'Bank Transfer') {
        bankTotal += amount;
        bankCount += 1;
      } else if (t.paymentMethod === 'ST Bank Transfer') {
        stTotal += amount;
        stCount += 1;
      } else if (t.paymentMethod === 'AIR Bank Transfer') {
        airTotal += amount;
        airCount += 1;
      }
    });

    return {
      totalSales,
      totalCount: transactions.length,
      cashTotal,
      cashCount,
      cardTotal,
      cardCount,
      bankTotal,
      bankCount,
      stTotal,
      stCount,
      airTotal,
      airCount,
    };
  }, [transactions]);

  const isLoading = loading ?? isServerLoading;

  if (transactions && stats) {
    return (
      <div className="grid gap-3.5 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <StatCard
          title="Total Sales"
          value={stats.totalSales}
          icon={CalendarDays}
          loading={isLoading}
          description={`${stats.totalCount} ${stats.totalCount === 1 ? 'sale' : 'sales'} (${dateLabel})`}
          className="border-indigo-200/70 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/40 to-white dark:from-indigo-950/20 dark:to-slate-900"
        />
        <StatCard
          title="Cash"
          value={stats.cashTotal}
          icon={Banknote}
          loading={isLoading}
          description={`${stats.cashCount} ${stats.cashCount === 1 ? 'sale' : 'sales'}`}
          className="border-emerald-200/70 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/40 to-white dark:from-emerald-950/20 dark:to-slate-900"
        />
        <StatCard
          title="Card Payment"
          value={stats.cardTotal}
          icon={CreditCard}
          loading={isLoading}
          description={`${stats.cardCount} ${stats.cardCount === 1 ? 'sale' : 'sales'}`}
          className="border-blue-200/70 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/40 to-white dark:from-blue-950/20 dark:to-slate-900"
        />
        <StatCard
          title="Bank Transfer"
          value={stats.bankTotal}
          icon={Landmark}
          loading={isLoading}
          description={`${stats.bankCount} ${stats.bankCount === 1 ? 'sale' : 'sales'}`}
          className="border-purple-200/70 dark:border-purple-900/50 bg-gradient-to-br from-purple-50/40 to-white dark:from-purple-950/20 dark:to-slate-900"
        />
        <StatCard
          title="ST Bank"
          value={stats.stTotal}
          icon={Building2}
          loading={isLoading}
          description={`${stats.stCount} ${stats.stCount === 1 ? 'sale' : 'sales'}`}
          className="border-amber-200/70 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/40 to-white dark:from-amber-950/20 dark:to-slate-900"
        />
        <StatCard
          title="AIR Bank"
          value={stats.airTotal}
          icon={Plane}
          loading={isLoading}
          description={`${stats.airCount} ${stats.airCount === 1 ? 'sale' : 'sales'}`}
          className="border-sky-200/70 dark:border-sky-900/50 bg-gradient-to-br from-sky-50/40 to-white dark:from-sky-950/20 dark:to-slate-900"
        />
      </div>
    );
  }

  // Fallback to all-time server aggregate view
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Today's Sales"
        value={serverStats?.dailySales ?? 0}
        icon={CalendarDays}
        loading={isLoading}
        description="Total sales for today"
      />
      <StatCard
        title="Total Cash Sales"
        value={serverStats?.cashTotal ?? 0}
        icon={Banknote}
        loading={isLoading}
        description="All-time cash transactions"
      />
      <StatCard
        title="Total Card Sales"
        value={serverStats?.cardTotal ?? 0}
        icon={CreditCard}
        loading={isLoading}
        description="All-time card transactions"
      />
      <StatCard
        title="Total Bank Sales"
        value={serverStats?.bankTotal ?? 0}
        icon={Landmark}
        loading={isLoading}
        description="All-time bank transfers"
      />
    </div>
  );
}
