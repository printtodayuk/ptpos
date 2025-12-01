
'use client';

import { useEffect, useState } from 'react';
import { getDashboardStats } from "@/lib/server-actions";
import { StatCard } from "@/components/dashboard/stat-card";
import { Loader, Ban, ClipboardCheck, Paintbrush, Truck } from "lucide-react";
import { CardDescription, CardHeader, CardTitle, Card, CardContent } from "@/components/ui/card";
import { Loader2 } from 'lucide-react';
import { LiveOperatorStatus } from '@/components/attendance/live-operator-status';

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
    studioCount: 0,
    mghCount: 0,
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
          <CardTitle className="text-xl">Job Sheet Status</CardTitle>
           <CardDescription>
            A real-time overview of current job sheet statuses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatCard title="In Production" value={stats.productionCount} icon={Loader} description="Jobs currently in production" isCurrency={false} className="bg-orange-500/10 border-orange-500 text-orange-700" />
              <StatCard title="On Hold" value={stats.holdCount} icon={Ban} description="Jobs waiting for action" isCurrency={false} className="bg-red-500/10 border-red-500 text-red-700" />
              <StatCard title="Unpaid" value={stats.unpaidCount} icon={ClipboardCheck} description="Jobs with outstanding payments" isCurrency={false} className="bg-yellow-500/10 border-yellow-500 text-yellow-700" />
              <StatCard title="In Studio" value={stats.studioCount} icon={Paintbrush} description="Jobs in the design phase" isCurrency={false} className="bg-blue-500/10 border-blue-500 text-blue-700" />
              <StatCard title="MGH" value={stats.mghCount} icon={Truck} description="Jobs with MGH status" isCurrency={false} className="bg-pink-500/10 border-pink-500 text-pink-700" />
          </div>
        </CardContent>
      </Card>

      <LiveOperatorStatus />
    </div>
  );
}
