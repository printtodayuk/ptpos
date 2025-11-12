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
import type { Transaction } from '@/lib/types';
import { TransactionSchema } from '@/lib/types';
import { getAuthenticatedAppForUser } from './firebase';
import { headers } from 'next/headers';

const CreateTransactionSchema = TransactionSchema.omit({ id: true, createdAt: true });

export async function addTransaction(
  data: z.infer<typeof CreateTransactionSchema>
) {
  const validatedData = CreateTransactionSchema.safeParse(data);
  if (!validatedData.success) {
    return { success: false, message: 'Validation failed.', errors: validatedData.error.flatten().fieldErrors };
  }
  
  const userId = validatedData.data.userId;
  if (!userId) {
      return { success: false, message: 'You must be logged in to add a transaction.' };
  }

  try {
    const { firestore } = await getAuthenticatedAppForUser(userId);
    
    await addDoc(collection(firestore, 'transactions'), {
      ...validatedData.data,
      date: Timestamp.fromDate(validatedData.data.date),
      createdAt: serverTimestamp(),
      userId: userId,
    });

    revalidatePath(`/${validatedData.data.type}`);
    revalidatePath('/dashboard');
    revalidatePath('/reporting');
    revalidatePath('/admin');

    return { success: true, message: 'Transaction added successfully.' };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}

async function getUserIdFromHeaders() {
    const headersList = headers();
    return headersList.get('x-user-id');
}

export async function getTransactions(
  type: 'invoicing' | 'non-invoicing',
  count: number = 20
): Promise<Transaction[]> {
  const userId = await getUserIdFromHeaders();
  if (!userId) return [];

  const { firestore } = await getAuthenticatedAppForUser(userId);

  const q = query(
    collection(firestore, 'transactions'),
    where('type', '==', type),
    where('userId', '==', userId),
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
    const userId = await getUserIdFromHeaders();
    if (!userId) {
        return {
            dailySales: 0,
            totalInputs: 0,
            cashAmount: 0,
            bankAmount: 0,
            cardAmount: 0,
        };
    }
    
    const { firestore } = await getAuthenticatedAppForUser(userId);

    const q = query(collection(firestore, 'transactions'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const transactions = querySnapshot.docs.map(doc => {
       const data = doc.data();
        return {
            ...data,
            id: doc.id,
            date: (data.date as Timestamp).toDate(),
        } as Transaction
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailySales = transactions
        .filter(t => t.date >= today)
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
  const userId = await getUserIdFromHeaders();
  if (!userId) return [];

  const { firestore } = await getAuthenticatedAppForUser(userId);

  const q = query(
    collection(firestore, 'transactions'),
    where('adminChecked', '==', false),
    where('userId', '==', userId),
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
    const userId = await getUserIdFromHeaders();
    
    if (!userId) {
        return { success: false, message: 'You must be logged in.' };
    }

    const { firestore } = await getAuthenticatedAppForUser(userId);

    const transactionRef = doc(firestore, 'transactions', id);
    await updateDoc(transactionRef, {
      adminChecked: true,
      checkedBy: 'admin', // Using a placeholder
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
  const userId = await getUserIdFromHeaders();
  if (!userId) return [];
  
  const { firestore } = await getAuthenticatedAppForUser(userId);

  const fromTimestamp = Timestamp.fromDate(from);
  const toTimestamp = Timestamp.fromDate(to);

  const q = query(
    collection(firestore, 'transactions'),
    where('userId', '==', userId),
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
