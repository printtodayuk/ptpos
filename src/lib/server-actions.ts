'use server';

import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Transaction } from '@/lib/types';
import { TransactionSchema } from '@/lib/types';
import { getDb } from '@/lib/firebase-admin';

const CreateTransactionSchema = TransactionSchema.omit({
  id: true,
  createdAt: true,
  userId: true, // Remove userId from validation
});

export async function addTransaction(
  data: z.infer<typeof CreateTransactionSchema>
) {
  const validatedData = CreateTransactionSchema.safeParse(data);
  if (!validatedData.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }

  try {
    const firestore = getDb();

    await addDoc(collection(firestore, 'transactions'), {
      ...validatedData.data,
      date: Timestamp.fromDate(validatedData.data.date),
      createdAt: serverTimestamp(),
    });

    revalidatePath(`/${validatedData.data.type}`);
    revalidatePath('/dashboard');
    revalidatePath('/reporting');
    revalidatePath('/admin');

    return { success: true, message: 'Transaction added successfully.' };
  } catch (error) {
    console.error('Error adding transaction:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: errorMessage };
  }
}

import {
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  doc,
  where,
} from 'firebase-admin/firestore';

export async function getTransactions(
  type: 'invoicing' | 'non-invoicing',
  count: number = 20
): Promise<Transaction[]> {
  try {
    const firestore = getDb();
    
    const q = query(
      collection(firestore, 'transactions'),
      where('type', '==', type),
      orderBy('createdAt', 'desc'),
      limit(count)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        date: (data.date as Timestamp).toDate(),
        createdAt: data.createdAt as Timestamp,
      } as Transaction;
    });
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getDashboardStats() {
  try {
    const firestore = getDb();
    
    const q = query(collection(firestore, 'transactions'));
    const querySnapshot = await getDocs(q);
    const transactions = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        date: (data.date as Timestamp).toDate(),
      } as Transaction;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailySales = transactions
      .filter((t) => t.date >= today)
      .reduce((sum, t) => sum + t.totalAmount, 0);

    const totalInputs = transactions.length;

    const cashAmount = transactions
      .filter((t) => t.paymentMethod === 'Cash')
      .reduce((sum, t) => sum + t.totalAmount, 0);
    const bankAmount = transactions
      .filter((t) => t.paymentMethod === 'Bank Transfer')
      .reduce((sum, t) => sum + t.totalAmount, 0);
    const cardAmount = transactions
      .filter((t) => t.paymentMethod === 'Card Payment')
      .reduce((sum, t) => sum + t.totalAmount, 0);

    return {
      dailySales,
      totalInputs,
      cashAmount,
      bankAmount,
      cardAmount,
    };
  } catch (e) {
    console.error(e);
    return {
      dailySales: 0,
      totalInputs: 0,
      cashAmount: 0,
      bankAmount: 0,
      cardAmount: 0,
    };
  }
}

export async function getPendingTransactions(): Promise<Transaction[]> {
  try {
    const firestore = getDb();
    
    const q = query(
      collection(firestore, 'transactions'),
      where('adminChecked', '==', false),
      orderBy('createdAt', 'asc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        date: (data.date as Timestamp).toDate(),
        createdAt: data.createdAt as Timestamp,
      } as Transaction;
    });
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function markTransactionAsChecked(id: string) {
  try {
    const firestore = getDb();

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

export async function getReportData({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): Promise<Transaction[]> {
  try {
    const firestore = getDb();
    
    const fromTimestamp = Timestamp.fromDate(from);
    const toTimestamp = Timestamp.fromDate(to);

    const q = query(
      collection(firestore, 'transactions'),
      where('date', '>=', fromTimestamp),
      where('date', '<=', toTimestamp),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        date: (data.date as Timestamp).toDate(),
        createdAt: data.createdAt as Timestamp,
      } as Transaction;
    });
  } catch (e) {
    console.error(e);
    return [];
  }
}