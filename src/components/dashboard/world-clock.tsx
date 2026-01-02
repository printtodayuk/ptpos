
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type WorldClockProps = {
  city: string;
  timeZone: string;
};

export function WorldClock({ city, timeZone }: WorldClockProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  const timeString = time.toLocaleTimeString('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div className="flex flex-col items-center justify-center text-center">
        <div className="text-2xl font-bold font-mono text-primary">
          {timeString}
        </div>
        <p className="text-xs text-muted-foreground">{city}</p>
    </div>
  );
}
