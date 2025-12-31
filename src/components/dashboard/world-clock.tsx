
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
  
  const dateString = time.toLocaleDateString('en-GB', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card className="flex flex-col items-center justify-center text-center">
      <CardHeader>
        <CardTitle className="text-xl">{city}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-5xl font-bold font-mono tracking-widest text-primary">
          {timeString}
        </div>
        <p className="text-muted-foreground mt-2">{dateString}</p>
      </CardContent>
    </Card>
  );
}
