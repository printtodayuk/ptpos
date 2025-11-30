
'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { type Operator, type TimeRecord } from '@/lib/types';
import {
  getOperatorStatus,
  handleClockIn,
  handleClockOut,
  handleStartBreak,
  handleEndBreak,
} from '@/lib/server-actions-attendance';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Clock, Coffee, LogIn, LogOut } from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { StatCard } from '@/components/dashboard/stat-card';
import { LiveOperatorStatus } from '@/components/attendance/live-operator-status';
import { useSession } from '@/components/auth/session-provider';

function formatDurationWithSeconds(seconds: number) {
  if (isNaN(seconds) || seconds < 0) return '00:00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  
  const pad = (num: number) => num.toString().padStart(2, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

export default function AttendancePage() {
  const { operator } = useSession();
  const [timeRecord, setTimeRecord] = useState<TimeRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, startTransition] = useTransition();
  const [currentTime, setCurrentTime] = useState(new Date());

  const { toast } = useToast();

  useEffect(() => {
    if (operator) {
      setIsLoading(true);
      getOperatorStatus(operator).then((status) => {
        setTimeRecord(status);
        setIsLoading(false);
      });
    } else {
      setTimeRecord(null);
      setIsLoading(false);
    }
  }, [operator]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000); // Update every second
    return () => clearInterval(timer);
  }, []);

  const handleAction = (action: (arg: any) => Promise<{ success: boolean; message: string }>, arg: any) => {
    startTransition(async () => {
      const result = await action(arg);
      if (result.success) {
        toast({ title: 'Success', description: result.message });
        if (operator) {
          const status = await getOperatorStatus(operator);
          setTimeRecord(status);
        }
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  };

  const ClockInButton = () => <Button onClick={() => handleAction(handleClockIn, operator)} disabled={isProcessing}><LogIn className="mr-2 h-4 w-4" />Clock In</Button>;
  const ClockOutButton = () => <Button variant="destructive" onClick={() => handleAction(handleClockOut, timeRecord?.id)} disabled={isProcessing || timeRecord?.status === 'on-break'}><LogOut className="mr-2 h-4 w-4" />Clock Out</Button>;
  const StartBreakButton = () => <Button variant="outline" onClick={() => handleAction(handleStartBreak, timeRecord?.id)} disabled={isProcessing}><Coffee className="mr-2 h-4 w-4" />Start Break</Button>;
  const EndBreakButton = () => <Button variant="outline" onClick={() => handleAction(handleEndBreak, timeRecord?.id)} disabled={isProcessing}><Coffee className="mr-2 h-4 w-4" />End Break</Button>;

  const renderStatus = () => {
    if (isLoading) return <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>;
    if (!operator) return <p className="text-center text-muted-foreground p-4">Could not identify operator.</p>;
    if (!timeRecord) return <div className="flex flex-col items-center gap-4 p-4"><p>You are not clocked in for today.</p><ClockInButton /></div>;

    const clockInTime = new Date(timeRecord.clockInTime);
    const now = currentTime;
    
    let currentBreakDuration = 0;
    const currentBreak = timeRecord.breaks.find(b => !b.endTime);
    if (currentBreak) {
        const breakStartTime = typeof currentBreak.startTime === 'string' ? new Date(currentBreak.startTime) : currentBreak.startTime;
        currentBreakDuration = differenceInSeconds(now, breakStartTime);
    }
    
    const totalCompletedBreakDuration = timeRecord.breaks
        .filter(b => b.endTime)
        .reduce((acc, b) => {
            const endTime = b.endTime ? new Date(b.endTime) : new Date();
            const startTime = new Date(b.startTime);
            return acc + differenceInSeconds(endTime, startTime)
        }, 0);

    const totalBreakSeconds = totalCompletedBreakDuration + currentBreakDuration;
    const totalSeconds = differenceInSeconds(now, clockInTime);
    const workSeconds = totalSeconds - totalBreakSeconds;

    return (
      <>
        <CardHeader>
             <div className="flex items-center justify-between">
                <CardTitle>Your Status: {operator}</CardTitle>
                <Badge className={cn('capitalize', timeRecord.status === 'clocked-in' ? 'bg-green-500' : 'bg-yellow-500', 'text-white')}>{timeRecord.status.replace('-', ' ')}</Badge>
            </div>
             <CardDescription>
                Clocked in since {format(clockInTime, 'p')}
            </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
           <StatCard title="Total Time" value={formatDurationWithSeconds(totalSeconds)} icon={Clock} isCurrency={false} />
           <StatCard title="Work Time" value={formatDurationWithSeconds(workSeconds)} icon={Clock} isCurrency={false} />
           <StatCard title="Break Time" value={formatDurationWithSeconds(totalBreakSeconds)} icon={Coffee} isCurrency={false} />
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
            {timeRecord.status === 'clocked-in' && <StartBreakButton />}
            {timeRecord.status === 'on-break' && <EndBreakButton />}
            <ClockOutButton />
        </CardFooter>
      </>
    );
  };
  
  return (
    <div className="flex flex-col gap-6">
      <CardHeader className="p-0">
          <CardTitle>Operator Attendance</CardTitle>
          <CardDescription>Clock in, clock out, and manage breaks.</CardDescription>
      </CardHeader>
      
      <LiveOperatorStatus />
      
       <Card className="w-full max-w-2xl mx-auto min-h-[200px]">
        {renderStatus()}
       </Card>
    </div>
  );
}
