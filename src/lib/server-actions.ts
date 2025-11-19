
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
  runTransaction,
  deleteDoc,
  where,
  writeBatch,
  QueryConstraint
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Transaction, PaymentMethod } from '@/lib/types';
import { TransactionSchema } from '@/lib/types';
import { db } from '@/lib/firebase';
import { startOfDay, endOfDay } from 'date-fns';

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

    if (newDocData) {
      newTransaction = {
        ...(newDocData as Omit<Transaction, 'id' | 'date' | 'createdAt'>),
        id: docRef.id,
        transactionId: newTransactionId,
        date: (newDocData.date as Timestamp).toDate(),
        createdAt: (newDocData.createdAt as Timestamp)?.toDate() || new Date(), 
      };
    }


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

    let transaction: Transaction | null = null;
    if (updatedData) {
        transaction = {
            ...(updatedData as Omit<Transaction, 'id' | 'date' | 'createdAt'>),
            id: updatedDocSnap.id,
            date: (updatedData.date as Timestamp).toDate(),
            createdAt: (updatedData.createdAt as Timestamp)?.toDate() || new Date(), 
        };
    }


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
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const allTransactionsQuery = query(collection(db, 'transactions'));
    const dailyTransactionsQuery = query(
      collection(db, 'transactions'),
      where('date', '>=', Timestamp.fromDate(todayStart)),
      where('date', '<=', Timestamp.fromDate(todayEnd))
    );

    const [allTransactionsSnapshot, dailyTransactionsSnapshot] = await Promise.all([
      getDocs(allTransactionsQuery),
      getDocs(dailyTransactionsQuery)
    ]);

    const allTransactions = allTransactionsSnapshot.docs.map(doc => doc.data() as Transaction);
    const dailyTransactions = dailyTransactionsSnapshot.docs.map(doc => doc.data() as Transaction);

    // Calculate daily stats
    const dailyCash = dailyTransactions
      .filter(t => t.paymentMethod === 'Cash')
      .reduce((sum, t) => sum + t.totalAmount, 0);
    const dailyBank = dailyTransactions
      .filter(t => t.paymentMethod === 'Bank Transfer')
      .reduce((sum, t) => sum + t.totalAmount, 0);
    const dailyCard = dailyTransactions
      .filter(t => t.paymentMethod === 'Card Payment')
      .reduce((sum, t) => sum + t.totalAmount, 0);

    // Calculate all-time stats
    const totalInputs = allTransactions.length;
    const cashAmount = allTransactions
      .filter((t) => t.paymentMethod === 'Cash')
      .reduce((sum, t) => sum + t.totalAmount, 0);
    const bankAmount = allTransactions
      .filter((t) => t.paymentMethod === 'Bank Transfer')
      .reduce((sum, t) => sum + t.totalAmount, 0);
    const cardAmount = allTransactions
      .filter((t) => t.paymentMethod === 'Card Payment')
      .reduce((sum, t) => sum + t.totalAmount, 0);
    const totalSales = allTransactions.reduce((sum, t) => sum + t.totalAmount, 0);

    return {
      totalSales,
      totalInputs,
      cashAmount,
      bankAmount,
      cardAmount,
      dailyCash,
      dailyBank,
      dailyCard,
    };
  } catch (e) {
    console.error(e);
    return {
      totalSales: 0,
      totalInputs: 0,
      cashAmount: 0,
      bankAmount: 0,
      cardAmount: 0,
      dailyCash: 0,
      dailyBank: 0,
      dailyCard: 0,
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

export async function searchTransactions(
  searchTerm: string,
  paymentMethod?: PaymentMethod
): Promise<Transaction[]> {
  
  const queryConstraints: QueryConstraint[] = [];

  if (paymentMethod) {
    queryConstraints.push(where('paymentMethod', '==', paymentMethod));
  }
  
  // Always order by creation date
  queryConstraints.push(orderBy('createdAt', 'desc'));


  if (!searchTerm) {
    // Return last 50 transactions if search term is empty, honoring filters
    queryConstraints.push(limit(50));
    const q = query(collection(db, 'transactions'), ...queryConstraints);
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
  }
  
  try {
    // This is not efficient for large datasets. For a production app,
    // a dedicated search service like Algolia or Elasticsearch is recommended.
    // We will query with the filter and then filter by search term in code.
    queryConstraints.push(limit(1000)); // Limiting for performance
    
    const q = query(collection(db, 'transactions'), ...queryConstraints);

    const querySnapshot = await getDocs(q);
    const transactions = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        date: (data.date as Timestamp).toDate(),
        createdAt: (data.createdAt as Timestamp)?.toDate(),
      } as Transaction;
    });

    const lowercasedTerm = searchTerm.toLowerCase();

    return transactions.filter((t) => {
      const tidMatch = t.transactionId?.toLowerCase().includes(lowercasedTerm);
      const clientMatch = t.clientName?.toLowerCase().includes(lowercasedTerm);
      const jobMatch = t.jobDescription?.toLowerCase().includes(lowercasedTerm);

      return tidMatch || clientMatch || jobMatch;
    });
  } catch (e) {
    console.error('Error searching transactions: ', e);
    return [];
  }
}

export async function deleteTransaction(id: string) {
    if (!id) {
        return { success: false, message: 'Transaction ID is required.' };
    }
    try {
        await deleteDoc(doc(db, 'transactions', id));
        revalidatePath('/admin');
        revalidatePath('/reporting');
        revalidatePath('/dashboard');
        revalidatePath('/invoicing');
        revalidatePath('/non-invoicing');
        return { success: true, message: 'Transaction deleted successfully.' };
    } catch (error) {
        console.error('Error deleting transaction:', error);
        const errorMessage =
            error instanceof Error ? error.message : 'An unexpected error occurred.';
        return { success: false, message: errorMessage };
    }
}


export async function bulkDeleteTransactions(ids: string[]) {
    if (!ids || ids.length === 0) {
        return { success: false, message: 'No transaction IDs provided.' };
    }
    try {
        const batch = writeBatch(db);
        ids.forEach(id => {
            const docRef = doc(db, 'transactions', id);
            batch.delete(docRef);
        });
        await batch.commit();

        revalidatePath('/admin');
        revalidatePath('/reporting');
        revalidatePath('/dashboard');
        revalidatePath('/invoicing');
        revalidatePath('/non-invoicing');

        return { success: true, message: `${ids.length} transaction(s) deleted successfully.` };
    } catch (error) {
        console.error('Error bulk deleting transactions:', error);
        return { success: false, message: 'An error occurred during bulk deletion.' };
    }
}

export async function bulkMarkAsChecked(ids: string[]) {
    if (!ids || ids.length === 0) {
        return { success: false, message: 'No transaction IDs provided.' };
    }
    try {
        const batch = writeBatch(db);
        ids.forEach(id => {
            const docRef = doc(db, 'transactions', id);
            batch.update(docRef, {
                adminChecked: true,
                checkedBy: 'admin (bulk)',
            });
        });
        await batch.commit();

        revalidatePath('/admin');
        revalidatePath('/reporting');

        return { success: true, message: `${ids.length} transaction(s) marked as checked.` };
    } catch (error) {
        console.error('Error bulk marking transactions:', error);
        return { success: false, message: 'An error occurred during bulk update.' };
    }
}