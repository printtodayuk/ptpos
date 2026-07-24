
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  loading?: boolean;
  isCurrency?: boolean;
  className?: string;
};

export function StatCard({ title, value, icon: Icon, description, loading, isCurrency = true, className }: StatCardProps) {
  if (loading) {
    return (
      <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <Skeleton className="h-4 w-24" />
          </CardTitle>
          <Skeleton className="h-9 w-9 rounded-xl" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-extrabold">
            <Skeleton className="h-8 w-28" />
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-2">
              <Skeleton className="h-3 w-36" />
            </p>
          )}
        </CardContent>
      </Card>
    );
  }
  
  const formattedValue = isCurrency && typeof value === 'number' 
    ? `£${value.toFixed(2)}` 
    : value;

  return (
    <Card className={cn(
      "group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300",
      className
    )}>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/80 via-accent/80 to-primary/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5 px-5">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</CardTitle>
        <div className="p-2.5 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-sm">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-1">
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{formattedValue}</div>
        {description && <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5">{description}</p>}
      </CardContent>
    </Card>
  );
}
