
'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAllOperatorStatuses, type OperatorStatusInfo } from '@/lib/server-actions-attendance';
import type { Operator, TimeRecordStatus } from '@/lib/types';
import { Loader2, RefreshCw, UserCheck, Coffee, LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { differenceInSeconds } from 'date-fns';

type OperatorStatuses = Record<Operator, OperatorStatusInfo>;

function formatDurationWithSeconds(seconds: number) {
  if (isNaN(seconds) || seconds < 0) return '00:00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  
  const pad = (num: number) => num.toString().padStart(2, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

const OperatorWithTimer = ({ name, startTime }: { name: Operator, startTime?: Date }) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        if (!startTime) return;
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, [startTime]);

    const duration = startTime ? formatDurationWithSeconds(differenceInSeconds(currentTime, new Date(startTime))) : null;

    return (
        <div className="flex items-center justify-between w-full">
            <span className="text-base">{name}</span>
            {duration && (
                <span className="font-mono text-sm text-muted-foreground">{duration}</span>
            )}
        </div>
    );
};


const StatusColumn = ({ title, operators, icon: Icon, badgeClass, statuses, timerType }: { title: string, operators: Operator[], icon: React.ElementType, badgeClass: string, statuses: OperatorStatuses | null, timerType: 'work' | 'break' | 'none' }) => (
    <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center">
            <Icon className="mr-2 h-5 w-5" />
            {title} ({operators.length})
        </h3>
        <div className="space-y-2">
            {operators.length > 0 ? (
                operators.map(op => {
                     const startTime = timerType === 'work' ? statuses?.[op]?.clockInTime : timerType === 'break' ? statuses?.[op]?.breakStartTime : undefined;
                    return (
                        <Badge key={op} className={cn("text-base px-3 py-1 w-full flex justify-between", badgeClass)}>
                            <OperatorWithTimer name={op} startTime={startTime}/>
                        </Badge>
                    )
                })
            ) : (
                <p className="text-sm text-muted-foreground">None</p>
            )}
        </div>
    </div>
);


export function LiveOperatorStatus() {
  const [statuses, setStatuses] = useState<OperatorStatuses | null>(null);
  const [isFetching, startFetching] = useTransition();

  const fetchStatuses = useCallback(() => {
    startFetching(async () => {
      const result = await getAllOperatorStatuses();
      setStatuses(result);
    });
  }, []);

  useEffect(() => {
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchStatuses]);

  const clockedIn = statuses ? Object.entries(statuses).filter(([, s]) => s.status === 'clocked-in').map(([op]) => op as Operator) : [];
  const onBreak = statuses ? Object.entries(statuses).filter(([, s]) => s.status === 'on-break').map(([op]) => op as Operator) : [];
  const clockedOut = statuses ? Object.entries(statuses).filter(([, s]) => s.status === 'clocked-out' || s.status === 'not-clocked-in').map(([op]) => op as Operator) : [];

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
                <StatusColumn title="Clocked In" operators={clockedIn} icon={UserCheck} badgeClass="bg-green-500 hover:bg-green-600 text-white" statuses={statuses} timerType="work" />
                <StatusColumn title="On Break" operators={onBreak} icon={Coffee} badgeClass="bg-yellow-500 hover:bg-yellow-600 text-black" statuses={statuses} timerType="break" />
                <StatusColumn title="Clocked Out" operators={clockedOut} icon={LogOut} badgeClass="bg-gray-400 hover:bg-gray-500 text-white" statuses={statuses} timerType="none" />
            </div>
        )}
      </CardContent>
    </Card>
  );
}
