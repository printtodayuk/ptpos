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
import { getFirestore } from 'firebase/firestore';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

// Helper to get a shared Firestore instance on the server.
function getDb() {
  const apps = getApps();
  const app = apps.length > 0 ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}


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
    const firestore = getDb();
    
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

export async function getTransactions(
  type: 'invoicing' | 'non-invoicing',
  userId: string,
  count: number = 20
): Promise<Transaction[]> {
  try {
    const firestore = getDb();
    if (!userId) return [];

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
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getDashboardStats(userId: string) {
    try {
      const firestore = getDb();
      if (!userId) {
          return {
              dailySales: 0,
              totalInputs: 0,
              cashAmount: 0,
              bankAmount: 0,
              cardAmount: 0,
          };
      }
      
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


export async function getPendingTransactions(userId: string): Promise<Transaction[]> {
  try {
    const firestore = getDb();
    if (!userId) return [];

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

export async function getReportData({ from, to, userId }: { from: Date; to: Date, userId: string }): Promise<Transaction[]> {
  try {
    const firestore = getDb();
    if (!userId) return [];
    
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
  } catch (e) {
    console.error(e);
    return [];
  }
}
