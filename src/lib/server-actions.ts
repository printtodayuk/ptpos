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
  runTransaction,
  DocumentReference,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Transaction } from '@/lib/types';
import { TransactionSchema } from '@/lib/types';
import { db } from '@/lib/firebase';

const CreateTransactionSchema = TransactionSchema.omit({
  id: true,
  transactionId: true,
  createdAt: true,
});

const UpdateTransactionSchema = CreateTransactionSchema.omit({
    adminChecked: true,
    checkedBy: true,
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
    const counterRef = doc(db, 'counters', 'transactions');
    
    let newTransaction: Transaction | null = null;
    
    const newTransactionId = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      // Initialize counter if it doesn't exist
      const currentCount = counterDoc.exists() ? counterDoc.data()?.count : 0;
      const newCount = (currentCount || 0) + 1;
      transaction.set(counterRef, { count: newCount }, { merge: true });
      return `TID${String(newCount).padStart(4, '0')}`;
    });
    
    const docRef = await addDoc(collection(db, 'transactions'), {
      ...validatedData.data,
      transactionId: newTransactionId,
      date: Timestamp.fromDate(validatedData.data.date),
      createdAt: serverTimestamp(),
      adminChecked: false, // Ensure this is false on creation
      checkedBy: null,
    });

    const newDocSnap = await getDoc(docRef);
    const newDocData = newDocSnap.data();

    newTransaction = {
      ...(newDocData as Omit<Transaction, 'id' | 'date' | 'createdAt'>),
      id: docRef.id,
      transactionId: newTransactionId,
      date: (newDocData?.date as Timestamp).toDate(),
      createdAt: (newDocData?.createdAt as Timestamp)?.toDate() || new Date(), 
    };

    revalidatePath(`/${validatedData.data.type}`);
    revalidatePath('/dashboard');
    revalidatePath('/reporting');
    revalidatePath('/admin');

    return { 
      success: true, 
      message: 'Transaction added successfully.',
      transaction: newTransaction
    };
  } catch (error) {
    console.error('Error adding transaction:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: errorMessage };
  }
}

export async function updateTransaction(
  id: string,
  data: z.infer<typeof UpdateTransactionSchema>
) {
  const validatedData = UpdateTransactionSchema.safeParse(data);
  if (!validatedData.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }
  
  try {
    const transactionRef = doc(db, 'transactions', id);
    await updateDoc(transactionRef, {
        ...validatedData.data,
        date: Timestamp.fromDate(validatedData.data.date),
    });

    const updatedDocSnap = await getDoc(transactionRef);
    const updatedData = updatedDocSnap.data();

    const transaction = {
        ...(updatedData as Omit<Transaction, 'id' | 'date' | 'createdAt'>),
        id: updatedDocSnap.id,
        date: (updatedData?.date as Timestamp).toDate(),
        createdAt: (updatedData?.createdAt as Timestamp)?.toDate() || new Date(), 
    };


    revalidatePath(`/${validatedData.data.type}`);
    revalidatePath('/dashboard');
    revalidatePath('/reporting');
    revalidatePath('/admin');

    return { success: true, message: 'Transaction updated successfully.', transaction };
  } catch (error) {
    console.error('Error updating transaction:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: errorMessage };
  }
}

export async function getTransactions(
  type: 'invoicing' | 'non-invoicing',
  count: number = 20
): Promise<Transaction[]> {
  try {
    const q = query(
      collection(db, 'transactions'),
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
        createdAt: (data.createdAt as Timestamp)?.toDate(),
      } as Transaction;
    });
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getDashboardStats() {
  try {
    const q = query(collection(db, 'transactions'));
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
      .filter((t) => new Date(t.date) >= today)
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
    const q = query(
      collection(db, 'transactions'),
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
        createdAt: (data.createdAt as Timestamp)?.toDate(),
      } as Transaction;
    });
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function markTransactionAsChecked(id: string) {
  try {
    const transactionRef = doc(db, 'transactions', id);
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
    const fromTimestamp = Timestamp.fromDate(from);
    const toTimestamp = Timestamp.fromDate(to);

    const q = query(
      collection(db, 'transactions'),
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
        createdAt: (data.createdAt as Timestamp)?.toDate(),
      } as Transaction;
    });
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function searchTransactions(type: 'invoicing' | 'non-invoicing'): Promise<Transaction[]> {
    // This action now only fetches the last 50 transactions for client-side filtering.
    try {
        const q = query(
            collection(db, "transactions"),
            where('type', '==', type),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: (data.date as Timestamp).toDate(),
                createdAt: (data.createdAt as Timestamp)?.toDate(),
            } as Transaction;
        });

    } catch (e) {
        console.error("Error searching transactions: ", e);
        return [];
    }
}
