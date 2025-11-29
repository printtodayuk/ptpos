
'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAllOperatorStatuses } from '@/lib/server-actions-attendance';
import type { Operator, TimeRecordStatus } from '@/lib/types';
import { Loader2, RefreshCw, UserCheck, Coffee, UserX, LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type OperatorStatuses = Record<Operator, TimeRecordStatus | 'not-clocked-in'>;

const StatusColumn = ({ title, operators, icon: Icon, badgeClass }: { title: string, operators: Operator[], icon: React.ElementType, badgeClass: string }) => (
    <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center">
            <Icon className="mr-2 h-5 w-5" />
            {title} ({operators.length})
        </h3>
        <div className="space-y-2">
            {operators.length > 0 ? (
                operators.map(op => (
                    <Badge key={op} className={cn("text-base px-3 py-1", badgeClass)}>{op}</Badge>
                ))
            ) : (
                <p className="text-sm text-muted-foreground">None</p>
            )}
        </div>
    </div>
);


export function LiveOperatorStatus() {
  const [statuses, setStatuses] = useState<OperatorStatuses | null>(null);
  const [isFetching, startFetching] = useTransition();

  const fetchStatuses = () => {
    startFetching(async () => {
      const result = await getAllOperatorStatuses();
      setStatuses(result);
    });
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  const clockedIn = statuses ? Object.entries(statuses).filter(([, s]) => s === 'clocked-in').map(([op]) => op as Operator) : [];
  const onBreak = statuses ? Object.entries(statuses).filter(([, s]) => s === 'on-break').map(([op]) => op as Operator) : [];
  const clockedOut = statuses ? Object.entries(statuses).filter(([, s]) => s === 'clocked-out' || s === 'not-clocked-in').map(([op]) => op as Operator) : [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Live Operator Status</CardTitle>
            <CardDescription>A real-time overview of todays attendance.</CardDescription>
          </div>
          <Button onClick={fetchStatuses} variant="outline" size="icon" disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isFetching && !statuses ? (
            <div className="flex justify-center items-center p-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatusColumn title="Clocked In" operators={clockedIn} icon={UserCheck} badgeClass="bg-green-500 hover:bg-green-600 text-white" />
                <StatusColumn title="On Break" operators={onBreak} icon={Coffee} badgeClass="bg-yellow-500 hover:bg-yellow-600 text-black" />
                <StatusColumn title="Clocked Out" operators={clockedOut} icon={LogOut} badgeClass="bg-gray-400 hover:bg-gray-500 text-white" />
            </div>
        )}
      </CardContent>
    </Card>
  );
}
