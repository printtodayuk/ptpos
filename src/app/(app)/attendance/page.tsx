'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { operators, type Operator, type TimeRecord } from '@/lib/types';
import {
  getOperatorStatus,
  handleClockIn,
  handleClockOut,
  handleStartBreak,
  handleEndBreak,
} from '@/lib/server-actions-attendance';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Clock, Coffee, LogIn, LogOut } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { StatCard } from '@/components/dashboard/stat-card';

function formatDuration(minutes: number) {
  if (isNaN(minutes) || minutes < 0) return '0h 0m';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

export default function AttendancePage() {
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [timeRecord, setTimeRecord] = useState<TimeRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, startTransition] = useTransition();
  const [currentTime, setCurrentTime] = useState(new Date());

  const { toast } = useToast();

  useEffect(() => {
    if (selectedOperator) {
      setIsLoading(true);
      getOperatorStatus(selectedOperator).then((status) => {
        setTimeRecord(status);
        setIsLoading(false);
      });
    } else {
      setTimeRecord(null);
      setIsLoading(false);
    }
  }, [selectedOperator]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const handleAction = (action: (arg: any) => Promise<{ success: boolean; message: string }>, arg: any) => {
    startTransition(async () => {
      const result = await action(arg);
      if (result.success) {
        toast({ title: 'Success', description: result.message });
        if (selectedOperator) {
          const status = await getOperatorStatus(selectedOperator);
          setTimeRecord(status);
        }
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  };

  const ClockInButton = () => <Button onClick={() => handleAction(handleClockIn, selectedOperator)} disabled={isProcessing}><LogIn className="mr-2 h-4 w-4" />Clock In</Button>;
  const ClockOutButton = () => <Button variant="destructive" onClick={() => handleAction(handleClockOut, timeRecord?.id)} disabled={isProcessing || timeRecord?.status === 'on-break'}><LogOut className="mr-2 h-4 w-4" />Clock Out</Button>;
  const StartBreakButton = () => <Button variant="outline" onClick={() => handleAction(handleStartBreak, timeRecord?.id)} disabled={isProcessing}><Coffee className="mr-2 h-4 w-4" />Start Break</Button>;
  const EndBreakButton = () => <Button variant="outline" onClick={() => handleAction(handleEndBreak, timeRecord?.id)} disabled={isProcessing}><Coffee className="mr-2 h-4 w-4" />End Break</Button>;

  const renderStatus = () => {
    if (isLoading) return <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>;
    if (!selectedOperator) return <p className="text-center text-muted-foreground p-4">Please select an operator.</p>;
    if (!timeRecord) return <div className="flex flex-col items-center gap-4 p-4"><p>Not clocked in for today.</p><ClockInButton /></div>;

    const clockInTime = timeRecord.clockInTime;
    const now = currentTime;
    
    let currentBreakDuration = 0;
    const currentBreak = timeRecord.breaks.find(b => !b.endTime);
    if (currentBreak) {
        currentBreakDuration = differenceInMinutes(now, currentBreak.startTime);
    }
    
    const totalCompletedBreakDuration = timeRecord.breaks
        .filter(b => b.endTime)
        .reduce((acc, b) => acc + differenceInMinutes(b.endTime!, b.startTime), 0);

    const totalBreakMinutes = totalCompletedBreakDuration + currentBreakDuration;
    const totalMinutes = differenceInMinutes(now, clockInTime);
    const workMinutes = totalMinutes - totalBreakMinutes;

    return (
      <>
        <CardHeader>
             <div className="flex items-center justify-between">
                <CardTitle>Current Status</CardTitle>
                <Badge className={cn('capitalize', timeRecord.status === 'clocked-in' ? 'bg-green-500' : 'bg-yellow-500', 'text-white')}>{timeRecord.status.replace('-', ' ')}</Badge>
            </div>
             <CardDescription>
                Clocked in since {format(clockInTime, 'p')}
            </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
           <StatCard title="Total Time" value={formatDuration(totalMinutes)} icon={Clock} isCurrency={false} />
           <StatCard title="Work Time" value={formatDuration(workMinutes)} icon={Clock} isCurrency={false} />
           <StatCard title="Break Time" value={formatDuration(totalBreakMinutes)} icon={Coffee} isCurrency={false} />
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

      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
            <CardTitle>Select Operator</CardTitle>
        </CardHeader>
        <CardContent>
            <Select onValueChange={(value: Operator) => setSelectedOperator(value)} value={selectedOperator || ''}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder="Select your name..." />
            </SelectTrigger>
            <SelectContent>
                {operators.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
            </SelectContent>
            </Select>
        </CardContent>
      </Card>
      
       <Card className="w-full max-w-2xl mx-auto min-h-[200px]">
        {renderStatus()}
       </Card>
    </div>
  );
}
