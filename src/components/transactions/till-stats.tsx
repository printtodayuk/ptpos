
'use client';

import { useEffect, useState } from 'react';
import { getTillStats } from '@/lib/server-actions';
import { StatCard } from '@/components/dashboard/stat-card';
import { Banknote, CalendarDays, CreditCard, Landmark, Loader2 } from 'lucide-react';

interface TillStatsData {
  dailySales: number;
  cashTotal: number;
  cardTotal: number;
  bankTotal: number;
}

export function TillStats() {
  const [stats, setStats] = useState<TillStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getTillStats().then(data => {
      if (data.success) {
        setStats({
          dailySales: data.dailySales,
          cashTotal: data.cashTotal,
          cardTotal: data.cardTotal,
          bankTotal: data.bankTotal,
        });
      }
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Today's Sales"
        value={stats?.dailySales ?? 0}
        icon={CalendarDays}
        loading={isLoading}
        description="Total sales for today"
      />
      <StatCard
        title="Total Cash Sales"
        value={stats?.cashTotal ?? 0}
        icon={Banknote}
        loading={isLoading}
        description="All-time cash transactions"
      />
      <StatCard
        title="Total Card Sales"
        value={stats?.cardTotal ?? 0}
        icon={CreditCard}
        loading={isLoading}
        description="All-time card transactions"
      />
      <StatCard
        title="Total Bank Sales"
        value={stats?.bankTotal ?? 0}
        icon={Landmark}
        loading={isLoading}
        description="All-time bank transfers"
      />
    </div>
  );
}
