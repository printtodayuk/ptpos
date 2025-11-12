'use client';

import { useEffect, useState } from 'react';
import { getDashboardStats } from "@/lib/server-actions";
import { StatCard } from "@/components/dashboard/stat-card";
import { PoundSterling, Hash, Landmark, CreditCard, HandCoins, CalendarClock } from "lucide-react";
import { CardDescription, CardHeader, CardTitle, Card, CardContent } from "@/components/ui/card";
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalInputs: 0,
    bankAmount: 0,
    cardAmount: 0,
    cashAmount: 0,
    dailyCash: 0,
    dailyBank: 0,
    dailyCard: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getDashboardStats().then(data => {
      setStats(data);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
        <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <CardHeader className="p-0">
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>An overview of your sales activity.</CardDescription>
      </CardHeader>

       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <CalendarClock className="h-5 w-5" />
            Today's Sales Summary
          </CardTitle>
          <CardDescription>
            Live sales figures for today. This will reset at midnight.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Daily Sales" value={stats.dailyBank + stats.dailyCard + stats.dailyCash} icon={PoundSterling} />
              <StatCard title="Daily Bank Transfers" value={stats.dailyBank} icon={Landmark} />
              <StatCard title="Daily Card Payments" value={stats.dailyCard} icon={CreditCard} />
              <StatCard title="Daily Cash Payments" value={stats.dailyCash} icon={HandCoins} />
          </div>
        </CardContent>
      </Card>
      
       <Card>
        <CardHeader>
          <CardTitle className="text-xl">All-Time Statistics</CardTitle>
           <CardDescription>
            A running total of all transactions recorded in the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Inputs" value={stats.totalInputs} icon={Hash} description="Total records entered" isCurrency={false} />
              <StatCard title="Total from Bank" value={stats.bankAmount} icon={Landmark} description="Total amount via bank" />
              <StatCard title="Total from Card" value={stats.cardAmount} icon={CreditCard} description="Total amount via card" />
              <StatCard title="Total from Cash" value={stats.cashAmount} icon={HandCoins} description="Total amount in cash" />
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
