
'use client';

import { useEffect, useState } from 'react';
import { getDashboardStats } from "@/lib/server-actions";
import { StatCard } from "@/components/dashboard/stat-card";
import { PoundSterling, Hash, Landmark, CreditCard, HandCoins, CalendarClock, Loader, Ban, ClipboardCheck } from "lucide-react";
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
    productionCount: 0,
    holdCount: 0,
    unpaidCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getDashboardStats().then(data => {
      if (data) {
        setStats(data);
      }
      setIsLoading(false);
    });
  }, []);

  if (isLoading || !stats) {
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
          <CardDescription>An overview of your sales and job sheet activity.</CardDescription>
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
          <CardTitle className="text-xl">Job Sheet Status</CardTitle>
           <CardDescription>
            A real-time overview of current job sheet statuses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <StatCard title="In Production" value={stats.productionCount} icon={Loader} description="Jobs currently in production" isCurrency={false} />
              <StatCard title="On Hold" value={stats.holdCount} icon={Ban} description="Jobs waiting for action" isCurrency={false} />
              <StatCard title="Unpaid" value={stats.unpaidCount} icon={ClipboardCheck} description="Jobs with outstanding payments" isCurrency={false} />
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
