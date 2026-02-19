'use server';

import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
  getDocs,
  getDoc,
  limit,
  orderBy,
  query,
  updateDoc,
  doc,
  where,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { differenceInMinutes } from 'date-fns';

import type { TimeRecord, Operator, TimeRecordStatus } from '@/lib/types';
import { TimeRecordSchema, UpdateTimeRecordSchema, operators } from '@/lib/types';
import { db } from '@/lib/firebase';

function getCurrentDateString() {
  return new Date().toISOString().split('T')[0];
}

export async function getOperatorStatus(operator: Operator): Promise<TimeRecord | null> {
  const date = getCurrentDateString();
  
  // Index-safe simple query: fetch today's records and filter in memory
  const q = query(
    collection(db, 'timeRecords'),
    where('date', '==', date)
  );

  const querySnapshot = await getDocs(q);

  const records = querySnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as any))
    .filter(d => d.operator === operator)
    .sort((a, b) => {
        const timeA = a.clockInTime instanceof Timestamp ? a.clockInTime.toMillis() : 0;
        const timeB = b.clockInTime instanceof Timestamp ? b.clockInTime.toMillis() : 0;
        return timeB - timeA;
    });

  const activeRecordData = records.find(d => ['clocked-in', 'on-break'].includes(d.status)) || records[0];

  if (!activeRecordData || activeRecordData.status === 'clocked-out') {
    return null;
  }

  return {
    ...activeRecordData,
    clockInTime: (activeRecordData.clockInTime as Timestamp).toDate(),
    clockOutTime: activeRecordData.clockOutTime ? (activeRecordData.clockOutTime as Timestamp).toDate() : null,
    breaks: (activeRecordData.breaks || []).map((b: any) => ({
      startTime: (b.startTime as Timestamp).toDate(),
      endTime: b.endTime ? (b.endTime as Timestamp).toDate() : null,
    })),
  } as TimeRecord;
}

export type OperatorStatusInfo = {
    status: TimeRecordStatus | 'not-clocked-in';
    clockInTime?: Date;
    breakStartTime?: Date;
}

export async function getAllOperatorStatuses(): Promise<Record<Operator, OperatorStatusInfo>> {
    const date = getCurrentDateString();
    const statuses: Record<Operator, OperatorStatusInfo> = {} as any;
    
    // Initialize
    for (const op of operators) {
        statuses[op] = { status: 'not-clocked-in' };
    }

    try {
        // Index-safe query: fetch all for today
        const q = query(
            collection(db, 'timeRecords'),
            where('date', '==', date)
        );

        const snapshot = await getDocs(q);
        const recordsByOp: Record<string, any[]> = {};

        snapshot.docs.forEach(doc => {
            const data = doc.data();
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
                statuses[op] = { status: 'clocked-out' };
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
                statuses[op] = info;
            }
        }
    } catch (e) {
        console.error("Error fetching statuses: ", e);
    }
    
    return statuses;
}


export async function handleClockIn(operator: Operator) {
  const existingRecord = await getOperatorStatus(operator);
  if (existingRecord) {
    return { success: false, message: 'You are already clocked in for today.' };
  }

  const newRecord = {
    operator,
    clockInTime: serverTimestamp(),
    clockOutTime: null,
    status: 'clocked-in' as const,
    breaks: [],
    totalWorkDuration: null,
    totalBreakDuration: null,
    date: getCurrentDateString(),
  };

  try {
    await addDoc(collection(db, 'timeRecords'), newRecord);
    revalidatePath('/attendance');
    revalidatePath('/admin-time');
    revalidatePath('/dashboard');
    return { success: true, message: 'Clocked in successfully.' };
  } catch (error) {
    return { success: false, message: 'Failed to clock in.' };
  }
}

export async function handleClockOut(recordId: string) {
  const recordRef = doc(db, 'timeRecords', recordId);
  const recordSnap = await getDoc(recordRef);

  if (!recordSnap.exists()) {
    return { success: false, message: 'Time record not found.' };
  }

  const record = recordSnap.data() as any;
  const clockInTime = (record.clockInTime as Timestamp).toDate();
  const now = new Date();
  
  if (record.status === 'on-break') {
     return { success: false, message: 'Please end your break before clocking out.' };
  }

  let totalBreakDuration = 0;
  record.breaks?.forEach((b: any) => {
    if (b.startTime && b.endTime) {
      totalBreakDuration += differenceInMinutes((b.endTime as Timestamp).toDate(), (b.startTime as Timestamp).toDate());
    }
  });

  const totalWorkDuration = differenceInMinutes(now, clockInTime) - totalBreakDuration;

  try {
    await updateDoc(recordRef, {
      clockOutTime: Timestamp.fromDate(now),
      status: 'clocked-out',
      totalWorkDuration: Math.max(0, totalWorkDuration),
      totalBreakDuration,
    });
    revalidatePath('/attendance');
    revalidatePath('/admin-time');
    revalidatePath('/dashboard');
    return { success: true, message: 'Clocked out successfully.' };
  } catch (error) {
    return { success: false, message: 'Failed to clock out.' };
  }
}

export async function handleStartBreak(recordId: string) {
  const recordRef = doc(db, 'timeRecords', recordId);
  const recordSnap = await getDoc(recordRef);
  
  if (!recordSnap.exists()) {
    return { success: false, message: 'Time record not found.' };
  }
  const record = recordSnap.data();
  
  if (record.status === 'on-break') {
    return { success: false, message: 'You are already on a break.' };
  }

  const newBreak = { startTime: Timestamp.now(), endTime: null };
  const updatedBreaks = [...(record.breaks || []), newBreak];

  try {
    await updateDoc(recordRef, {
      status: 'on-break',
      breaks: updatedBreaks,
    });
    revalidatePath('/attendance');
    revalidatePath('/admin-time');
    revalidatePath('/dashboard');
    return { success: true, message: 'Break started.' };
  } catch (error) {
    return { success: false, message: 'Failed to start break.' };
  }
}

export async function handleEndBreak(recordId: string) {
  const recordRef = doc(db, 'timeRecords', recordId);
  const recordSnap = await getDoc(recordRef);

  if (!recordSnap.exists()) {
    return { success: false, message: 'Time record not found.' };
  }
  
  const record = recordSnap.data();

  if (record.status !== 'on-break') {
    return { success: false, message: 'You are not on a break.' };
  }

  const updatedBreaks = [...(record.breaks || [])];
  const currentBreak = updatedBreaks.find(b => b.endTime === null);

  if (currentBreak) {
    currentBreak.endTime = Timestamp.now();
  }

  try {
    await updateDoc(recordRef, {
      status: 'clocked-in',
      breaks: updatedBreaks,
    });
    revalidatePath('/attendance');
    revalidatePath('/admin-time');
    revalidatePath('/dashboard');
    return { success: true, message: 'Break ended.' };
  } catch (error) {
    return { success: false, message: 'Failed to end break.' };
  }
}

export async function getTimeRecordsForReport({ startDate, endDate }: { startDate?: string, endDate?: string }): Promise<TimeRecord[]> {
  try {
    const constraints = [orderBy('clockInTime', 'desc')];
    if (startDate) {
        constraints.push(where('clockInTime', '>=', Timestamp.fromDate(new Date(startDate))));
    }
     if (endDate) {
        constraints.push(where('clockInTime', '<=', Timestamp.fromDate(new Date(endDate))));
    }
    
    const q = query(collection(db, 'timeRecords'), ...constraints);
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        clockInTime: (data.clockInTime as Timestamp).toDate(),
        clockOutTime: data.clockOutTime ? (data.clockOutTime as Timestamp).toDate() : null,
        breaks: data.breaks?.map((b: any) => ({
            startTime: b.startTime ? (b.startTime as Timestamp).toDate() : null,
            endTime: b.endTime ? (b.endTime as Timestamp).toDate() : null,
        })) || [],
      } as TimeRecord;
    });
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function updateTimeRecord(id: string, data: z.infer<typeof UpdateTimeRecordSchema>) {
    const validatedData = UpdateTimeRecordSchema.safeParse(data);
    if (!validatedData.success) {
        return {
            success: false,
            message: 'Validation failed.',
            errors: validatedData.error.flatten().fieldErrors,
        };
    }
    
    const recordRef = doc(db, 'timeRecords', id);
    
    try {
        const { clockInTime, clockOutTime, breaks, status } = validatedData.data;

        let totalBreakDuration = 0;
        const processedBreaks = breaks.map(b => {
            if (b.startTime && b.endTime) {
                 totalBreakDuration += differenceInMinutes(b.endTime, b.startTime);
            }
            return {
                startTime: b.startTime ? Timestamp.fromDate(b.startTime) : null,
                endTime: b.endTime ? Timestamp.fromDate(b.endTime) : null,
            };
        }).filter(b => b.startTime);

        let totalWorkDuration = 0;
        if (clockOutTime) {
            totalWorkDuration = differenceInMinutes(clockOutTime, clockInTime) - totalBreakDuration;
        }

        const dataToUpdate = {
            ...validatedData.data,
            clockInTime: Timestamp.fromDate(clockInTime),
            clockOutTime: clockOutTime ? Timestamp.fromDate(clockOutTime) : null,
            breaks: processedBreaks,
            totalWorkDuration: Math.max(0, totalWorkDuration),
            totalBreakDuration: Math.max(0, totalBreakDuration),
            status: status || (clockOutTime ? 'clocked-out' : 'clocked-in')
        };
        
        await updateDoc(recordRef, dataToUpdate);

        revalidatePath('/admin-time');
        revalidatePath('/attendance-report');
        revalidatePath('/dashboard');

        return { success: true, message: 'Time record updated successfully.' };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        return { success: false, message: errorMessage };
    }
}
