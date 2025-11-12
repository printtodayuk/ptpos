'use server';

import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import type { Transaction } from '@/lib/types';
import { TransactionSchema } from '@/lib/types';

const CreateTransactionSchema = TransactionSchema.omit({ id: true, createdAt: true });

export async function addTransaction(data: z.infer<typeof CreateTransactionSchema>) {
  try {
    const validatedData = CreateTransactionSchema.parse(data);
    
    await addDoc(collection(db, 'transactions'), {
      ...validatedData,
      date: Timestamp.fromDate(validatedData.date),
      createdAt: serverTimestamp(),
    });

    revalidatePath(`/${validatedData.type}`);
    revalidatePath('/dashboard');
    revalidatePath('/reporting');
    revalidatePath('/admin');

    return { success: true, message: 'Transaction added successfully.' };
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Validation failed.', errors: error.flatten().fieldErrors };
    }
    return { success: false, message: 'An unexpected error occurred.' };
  }
}

export async function getTransactions(
  type: 'invoicing' | 'non-invoicing',
  count: number = 20
): Promise<Transaction[]> {
  const q = query(
    collection(db, 'transactions'),
    where('type', '==', type),
    orderBy('createdAt', 'desc'),
    limit(count)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      date: (data.date as Timestamp).toDate(),
      createdAt: data.createdAt as Timestamp,
    } as Transaction;
  });
}

export async function getDashboardStats() {
    const querySnapshot = await getDocs(collection(db, 'transactions'));
    const transactions = querySnapshot.docs.map(doc => ({...doc.data(), id: doc.id} as Transaction));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailySales = transactions
        .filter(t => (t.date as unknown as Timestamp).toDate() >= today)
        .reduce((sum, t) => sum + t.totalAmount, 0);

    const totalInputs = transactions.length;
    
    const cashAmount = transactions.filter(t => t.paymentMethod === 'Cash').reduce((sum, t) => sum + t.totalAmount, 0);
    const bankAmount = transactions.filter(t => t.paymentMethod === 'Bank Transfer').reduce((sum, t) => sum + t.totalAmount, 0);
    const cardAmount = transactions.filter(t => t.paymentMethod === 'Card Payment').reduce((sum, t) => sum + t.totalAmount, 0);

    return {
        dailySales,
        totalInputs,
        cashAmount,
        bankAmount,
        cardAmount,
    };
}


export async function getPendingTransactions(): Promise<Transaction[]> {
  const q = query(
    collection(db, 'transactions'),
    where('adminChecked', '==', false),
    orderBy('createdAt', 'asc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      date: (data.date as Timestamp).toDate(),
      createdAt: data.createdAt as Timestamp,
    } as Transaction;
  });
}

export async function markTransactionAsChecked(id: string) {
  try {
    const transactionRef = doc(db, 'transactions', id);
    await updateDoc(transactionRef, {
      adminChecked: true,
      checkedBy: 'admin',
    });
    revalidatePath('/admin');
    revalidatePath('/reporting');
    return { success: true, message: 'Transaction marked as checked.' };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Failed to update transaction.' };
  }
}

export async function getReportData({ from, to }: { from: Date; to: Date }): Promise<Transaction[]> {
  const fromTimestamp = Timestamp.fromDate(from);
  const toTimestamp = Timestamp.fromDate(to);

  const q = query(
    collection(db, 'transactions'),
    where('date', '>=', fromTimestamp),
    where('date', '<=', toTimestamp),
    orderBy('date', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      date: (data.date as Timestamp).toDate(),
      createdAt: data.createdAt as Timestamp,
    } as Transaction;
  });
}
