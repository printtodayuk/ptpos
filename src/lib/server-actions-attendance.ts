
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

import type { TimeRecord, Operator } from '@/lib/types';
import { TimeRecordSchema, UpdateTimeRecordSchema } from '@/lib/types';
import { db } from '@/lib/firebase';

function getCurrentDateString() {
  return new Date().toISOString().split('T')[0];
}

export async function getOperatorStatus(operator: Operator): Promise<TimeRecord | null> {
  const date = getCurrentDateString();
  
  const q = query(
    collection(db, 'timeRecords'),
    where('operator', '==', operator),
    where('date', '==', date)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }
  
  const records = querySnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.clockInTime as Timestamp).toMillis() - (a.clockInTime as Timestamp).toMillis());

  const activeRecordData = records.find(d => ['clocked-in', 'on-break'].includes(d.status));

  if (!activeRecordData) {
    return null;
  }

  const data = activeRecordData;
  return {
    ...data,
    id: data.id,
    clockInTime: (data.clockInTime as Timestamp).toDate(),
    clockOutTime: data.clockOutTime ? (data.clockOutTime as Timestamp).toDate() : null,
    breaks: data.breaks.map((b: any) => ({
      startTime: (b.startTime as Timestamp).toDate(),
      endTime: b.endTime ? (b.endTime as Timestamp).toDate() : null,
    })),
  } as TimeRecord;
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

        return { success: true, message: 'Time record updated successfully.' };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        return { success: false, message: errorMessage };
    }
}
