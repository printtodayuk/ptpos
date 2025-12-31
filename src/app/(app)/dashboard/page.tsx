

'use client';

import { useEffect, useState } from 'react';
import { getDashboardStats } from "@/lib/server-actions";
import { StatCard } from "@/components/dashboard/stat-card";
import { Loader, Ban, Paintbrush, Truck, PackageCheck, Package, ThumbsDown, PackageX, Wand, Wrench, Send, Hourglass, CheckCircle2, XCircle } from "lucide-react";
import { CardDescription, CardHeader, CardTitle, Card, CardContent } from "@/components/ui/card";
import { Loader2 } from 'lucide-react';
import { LiveOperatorStatus } from '@/components/attendance/live-operator-status';
import { WorldClock } from '@/components/dashboard/world-clock';

export default function DashboardPage() {
  const [stats, setStats] = useState<{
    productionCount: number;
    finishingCount: number;
    holdCount: number;
    studioCount: number;
    mghCount: number;
    cancelCount: number;
    readyPickupCount: number;
    parcelCompareCount: number;
    deliveredCount: number;
    osCount: number;
    sentCount: number;
    quotationHoldCount: number;
    wfrCount: number;
    approvedCount: number;
    declinedCount: number;
  } | null>(null);

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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <StatCard title="On Hold" value={stats.holdCount} icon={Ban} description="Jobs waiting for action" isCurrency={false} className="bg-red-500/10 border-red-500 text-red-700" />
              <StatCard title="In Studio" value={stats.studioCount} icon={Paintbrush} description="Jobs in the design phase" isCurrency={false} className="bg-blue-500/10 border-blue-500 text-blue-700" />
              <StatCard title="In Production" value={stats.productionCount} icon={Loader} description="Jobs currently being made" isCurrency={false} className="bg-orange-500/10 border-orange-500 text-orange-700" />
              <StatCard title="Finishing" value={stats.finishingCount} icon={Wrench} description="Jobs in finishing stage" isCurrency={false} className="bg-teal-500/10 border-teal-500 text-teal-700" />
               <StatCard title="Ready for Pickup" value={stats.readyPickupCount} icon={Package} description="Jobs ready for client pickup" isCurrency={false} className="bg-purple-500/10 border-purple-500 text-purple-700" />
              <StatCard title="Parcel Compare" value={stats.parcelCompareCount} icon={PackageCheck} description="Jobs awaiting shipping label" isCurrency={false} className="bg-yellow-500/10 border-yellow-500 text-yellow-700" />
              <StatCard title="Delivered" value={stats.deliveredCount} icon={Truck} description="Jobs completed and delivered" isCurrency={false} className="bg-green-500/10 border-green-500 text-green-700" />
              <StatCard title="MGH" value={stats.mghCount} icon={ThumbsDown} description="Jobs with MGH status" isCurrency={false} className="bg-pink-500/10 border-pink-500 text-pink-700" />
              <StatCard title="OS" value={stats.osCount} icon={Wand} description="Jobs with OS status" isCurrency={false} className="bg-indigo-500/10 border-indigo-500 text-indigo-700" />
              <StatCard title="Cancelled" value={stats.cancelCount} icon={PackageX} description="Jobs that have been cancelled" isCurrency={false} className="bg-gray-500/10 border-gray-500 text-gray-700" />
          </div>
        </CardContent>
      </Card>
      
       <Card>
        <CardHeader>
          <CardTitle className="text-xl">Quotation Status</CardTitle>
           <CardDescription>
            A real-time overview of current quotation statuses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <StatCard title="Sent" value={stats.sentCount} icon={Send} description="Quotations sent to clients" isCurrency={false} className="bg-blue-500/10 border-blue-500 text-blue-700" />
              <StatCard title="On Hold" value={stats.quotationHoldCount} icon={Ban} description="Quotations on hold" isCurrency={false} className="bg-yellow-500/10 border-yellow-500 text-yellow-700" />
              <StatCard title="Waiting for Response" value={stats.wfrCount} icon={Hourglass} description="Awaiting client feedback" isCurrency={false} className="bg-purple-500/10 border-purple-500 text-purple-700" />
              <StatCard title="Approved" value={stats.approvedCount} icon={CheckCircle2} description="Quotations approved by clients" isCurrency={false} className="bg-green-500/10 border-green-500 text-green-700" />
              <StatCard title="Declined" value={stats.declinedCount} icon={XCircle} description="Quotations declined by clients" isCurrency={false} className="bg-red-500/10 border-red-500 text-red-700" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="text-xl">Office Clocks</CardTitle>
            <CardDescription>
                Live time for London and Dhaka offices.
            </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 md:grid-cols-2">
            <WorldClock city="London" timeZone="Europe/London" />
            <WorldClock city="Dhaka" timeZone="Asia/Dhaka" />
        </CardContent>
      </Card>

      <LiveOperatorStatus />
    </div>
  );
}
