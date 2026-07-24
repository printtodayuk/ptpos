
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDashboardStats } from "@/lib/server-actions";
import { StatCard } from "@/components/dashboard/stat-card";
import { Loader, Ban, Paintbrush, Truck, PackageCheck, Package, ThumbsDown, PackageX, Wand, Wrench, Send, Hourglass, CheckCircle2, XCircle, PlusCircle, FileText, ClipboardList, Sparkles } from "lucide-react";
import { CardDescription, CardHeader, CardTitle, Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from 'lucide-react';
import { LiveOperatorStatus } from '@/components/attendance/live-operator-status';
import { TaskDashboardSection } from '@/components/tasks/TaskDashboardSection';
import { NoticeDisplay } from '@/components/dashboard/notice-display';
import { useSession } from '@/components/auth/session-provider';

export default function DashboardPage() {
  const { operator } = useSession();
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (isLoading || !stats) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-sm font-semibold text-muted-foreground animate-pulse">Loading EPOS Dashboard...</p>
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full animate-in fade-in-50 slide-in-from-bottom-3 duration-500">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-indigo-200 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Print Today EPOS Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-rose-200">{operator || 'Team'}</span>!
            </h1>
            <p className="text-sm text-indigo-200 mt-1 max-w-xl">
              Here is an overview of your print production, quotations, and active job sheet workflows today.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 sm:self-center">
            <Button asChild size="sm" className="rounded-xl bg-white text-indigo-900 hover:bg-slate-100 font-bold shadow-md hover:shadow-lg transition-all duration-200">
              <Link href="/job-sheet">
                <PlusCircle className="mr-1.5 h-4 w-4 text-indigo-600" />
                New Job Sheet
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md font-semibold">
              <Link href="/quotation">
                <ClipboardList className="mr-1.5 h-4 w-4 text-purple-300" />
                New Quotation
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md font-semibold">
              <Link href="/invoice-generator">
                <FileText className="mr-1.5 h-4 w-4 text-amber-300" />
                New Invoice
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <NoticeDisplay />
      
       <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/60 pb-4">
          <CardTitle className="text-xl font-extrabold tracking-tight">Job Sheet Status Overview</CardTitle>
          <CardDescription>
            Live real-time status counts across all ongoing job sheet orders.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatCard title="In Production" value={stats.productionCount} icon={Loader} description="Jobs currently being printed/made" isCurrency={false} />
              <StatCard title="In Studio" value={stats.studioCount} icon={Paintbrush} description="Jobs in design & artwork phase" isCurrency={false} />
              <StatCard title="Finishing" value={stats.finishingCount} icon={Wrench} description="Jobs in binding/finishing stage" isCurrency={false} />
              <StatCard title="Ready for Pickup" value={stats.readyPickupCount} icon={Package} description="Jobs ready for client collection" isCurrency={false} />
              <StatCard title="On Hold" value={stats.holdCount} icon={Ban} description="Jobs waiting on customer response" isCurrency={false} />
              <StatCard title="Parcel Compare" value={stats.parcelCompareCount} icon={PackageCheck} description="Jobs awaiting dispatch labels" isCurrency={false} />
              <StatCard title="Delivered" value={stats.deliveredCount} icon={Truck} description="Jobs completed and delivered" isCurrency={false} />
              <StatCard title="MGH" value={stats.mghCount} icon={ThumbsDown} description="Jobs marked with MGH status" isCurrency={false} />
              <StatCard title="OS" value={stats.osCount} icon={Wand} description="Jobs marked with OS status" isCurrency={false} />
              <StatCard title="Cancelled" value={stats.cancelCount} icon={PackageX} description="Jobs that have been cancelled" isCurrency={false} />
          </div>
        </CardContent>
      </Card>
      
      <TaskDashboardSection />

       <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/60 pb-4">
          <CardTitle className="text-xl font-extrabold tracking-tight">Quotation Pipeline</CardTitle>
          <CardDescription>
            Live real-time overview of current quotation proposals.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatCard title="Sent to Client" value={stats.sentCount} icon={Send} description="Quotations delivered to clients" isCurrency={false} />
              <StatCard title="Waiting Response" value={stats.wfrCount} icon={Hourglass} description="Awaiting client confirmation" isCurrency={false} />
              <StatCard title="Approved" value={stats.approvedCount} icon={CheckCircle2} description="Quotations accepted by clients" isCurrency={false} />
              <StatCard title="On Hold" value={stats.quotationHoldCount} icon={Ban} description="Quotations currently on hold" isCurrency={false} />
              <StatCard title="Declined" value={stats.declinedCount} icon={XCircle} description="Quotations declined by clients" isCurrency={false} />
          </div>
        </CardContent>
      </Card>

      <LiveOperatorStatus />
    </div>
  );
}
