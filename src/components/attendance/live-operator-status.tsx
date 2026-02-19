'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { operators, type Operator, type TimeRecordStatus } from '@/lib/types';
import { UserCheck, Coffee, LogOut, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { differenceInSeconds } from 'date-fns';

type OperatorStatusInfo = {
    status: TimeRecordStatus | 'not-clocked-in';
    clockInTime?: Date;
    breakStartTime?: Date;
}

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
            <span className="text-base font-semibold">{name}</span>
            {duration && (
                <span className="font-mono text-sm opacity-80">{duration}</span>
            )}
        </div>
    );
};


const StatusColumn = ({ title, operators: opList, icon: Icon, badgeClass, statuses, timerType }: { title: string, operators: Operator[], icon: React.ElementType, badgeClass: string, statuses: OperatorStatuses | null, timerType: 'work' | 'break' | 'none' }) => (
    <div className="space-y-3 p-4 rounded-xl bg-white/50 border border-white/20 shadow-sm">
        <h3 className="text-lg font-bold flex items-center text-primary">
            <Icon className="mr-2 h-5 w-5" />
            {title} ({opList.length})
        </h3>
        <div className="space-y-2">
            {opList.length > 0 ? (
                opList.map(op => {
                     const startTime = timerType === 'work' ? statuses?.[op]?.clockInTime : timerType === 'break' ? statuses?.[op]?.breakStartTime : undefined;
                    return (
                        <Badge key={op} className={cn("text-base px-4 py-2 w-full flex justify-between border-transparent shadow-sm", badgeClass)}>
                            <OperatorWithTimer name={op} startTime={startTime}/>
                        </Badge>
                    )
                })
            ) : (
                <p className="text-sm text-muted-foreground italic">No operators currently {title.toLowerCase()}</p>
            )}
        </div>
    </div>
);


export function LiveOperatorStatus() {
  const [statuses, setStatuses] = useState<OperatorStatuses | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    
    // Index-safe simple query: fetch all for today. 
    // real-time listener drastically reduces reads and solves the index error.
    const q = query(
        collection(db, 'timeRecords'),
        where('date', '==', today)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const newStatuses: OperatorStatuses = {} as any;
        operators.forEach(op => newStatuses[op] = { status: 'not-clocked-in' });

        const recordsByOp: Record<string, any[]> = {};
        snapshot.docs.forEach(d => {
            const data = d.data();
            if (!recordsByOp[data.operator]) recordsByOp[data.operator] = [];
            recordsByOp[data.operator].push(data);
        });

        for (const op of operators) {
            const records = recordsByOp[op];
            if (!records || records.length === 0) continue;

            records.sort((a, b) => {
                const timeA = a.clockInTime instanceof Timestamp ? a.clockInTime.toMillis() : 0;
                const timeB = b.clockInTime instanceof Timestamp ? b.clockInTime.toMillis() : 0;
                return timeB - timeA;
            });

            const latest = records[0];
            if (latest.status === 'clocked-out') {
                newStatuses[op] = { status: 'clocked-out' };
            } else {
                const info: OperatorStatusInfo = {
                    status: latest.status,
                    clockInTime: (latest.clockInTime as Timestamp).toDate(),
                };
                if (latest.status === 'on-break') {
                    const currentBreak = latest.breaks?.find((b: any) => !b.endTime);
                    if (currentBreak) {
                        info.breakStartTime = (currentBreak.startTime as Timestamp).toDate();
                    }
                }
                newStatuses[op] = info;
            }
        }
        setStatuses(newStatuses);
        setIsLoading(false);
    }, (error) => {
        console.error("Listener error:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const clockedIn = statuses ? Object.entries(statuses).filter(([, s]) => s.status === 'clocked-in').map(([op]) => op as Operator) : [];
  const onBreak = statuses ? Object.entries(statuses).filter(([, s]) => s.status === 'on-break').map(([op]) => op as Operator) : [];
  const clockedOut = statuses ? Object.entries(statuses).filter(([, s]) => s.status === 'clocked-out' || s.status === 'not-clocked-in').map(([op]) => op as Operator) : [];

  return (
    <Card className="border-primary/20 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-primary">Real-Time Operator Attendance</CardTitle>
            <CardDescription className="font-medium">Updates instantly. No refresh required.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 bg-white/30 backdrop-blur-sm">
        {isLoading && !statuses ? (
            <div className="flex justify-center items-center p-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatusColumn title="Working" operators={clockedIn} icon={UserCheck} badgeClass="bg-green-500 hover:bg-green-600 text-white" statuses={statuses} timerType="work" />
                <StatusColumn title="On Break" operators={onBreak} icon={Coffee} badgeClass="bg-yellow-500 hover:bg-yellow-600 text-black" statuses={statuses} timerType="break" />
                <StatusColumn title="Offline" operators={clockedOut} icon={LogOut} badgeClass="bg-slate-400 hover:bg-slate-500 text-white" statuses={statuses} timerType="none" />
            </div>
        )}
      </CardContent>
    </Card>
  );
}
