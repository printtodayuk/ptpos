
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
import type { Transaction, PaymentMethod, JobSheet, PaymentStatus } from '@/lib/types';
import { TransactionSchema } from '@/lib/types';
import { db } from '@/lib/firebase';
import { startOfDay, endOfDay, parseISO, isValid } from 'date-fns';

const CreateTransactionSchema = TransactionSchema.omit({
  id: true,
  transactionId: true,
  createdAt: true,
});

const UpdateTransactionSchema = CreateTransactionSchema.omit({
    adminChecked: true,
    checkedBy: true,
});

async function updateJobSheetPaymentStatus(jobId: string, transactionIdToExclude: string | null = null) {
    const jobSheetQuery = query(collection(db, 'jobSheets'), where('jobId', '==', jobId), limit(1));
    const jobSheetSnapshot = await getDocs(jobSheetQuery);

    if (jobSheetSnapshot.empty) {
        console.warn(`Job sheet with JID ${jobId} not found. Cannot update payment status.`);
        return; 
    }
    
    const jobSheetRef = jobSheetSnapshot.docs[0].ref;
    const jobSheetData = jobSheetSnapshot.docs[0].data() as Omit<JobSheet, 'id'>;

    const transactionsQuery = query(collection(db, 'transactions'), where('jid', '==', jobId));
    const transactionsSnapshot = await getDocs(transactionsQuery);
    
    let totalPaid = 0;
    transactionsSnapshot.docs.forEach(doc => {
        if (doc.id !== transactionIdToExclude) {
            totalPaid += (doc.data().paidAmount || 0);
        }
    });

    const newDueAmount = jobSheetData.totalAmount - totalPaid;
    
    let newPaymentStatus: PaymentStatus = 'Unpaid';
    if (newDueAmount <= 0.001) { // Use a small tolerance for float comparison
        newPaymentStatus = 'Paid';
    } else if (totalPaid > 0) {
        newPaymentStatus = 'Partially Paid';
    }

    await updateDoc(jobSheetRef, {
        paidAmount: totalPaid,
        dueAmount: newDueAmount,
        paymentStatus: newPaymentStatus,
    });
}


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
      const currentCount = counterDoc.exists() ? counterDoc.data()?.count : 0;
      const newCount = (currentCount || 0) + 1;
      transaction.set(counterRef, { count: newCount }, { merge: true });
      return `TID${String(newCount).padStart(4, '0')}`;
    });
    
    const docRef = await addDoc(collection(db, 'transactions'), {
      ...validatedData.data,
      transactionId: newTransactionId,
      date: Timestamp.fromDate(validatedData.data.date as Date),
      createdAt: serverTimestamp(),
      adminChecked: false,
      checkedBy: null,
      jid: validatedData.data.jid || null,
    });
    
    if (data.jid) {
        await updateJobSheetPaymentStatus(data.jid);
    }

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

    revalidatePath(`/non-invoicing`);
    revalidatePath('/dashboard');
    revalidatePath('/reporting');
    revalidatePath('/admin');
    revalidatePath('/job-sheet');

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
    const originalTransactionSnap = await getDoc(transactionRef);
    const originalTransaction = originalTransactionSnap.data() as Transaction;
    
    await updateDoc(transactionRef, {
        ...validatedData.data,
        date: Timestamp.fromDate(validatedData.data.date as Date),
        jid: validatedData.data.jid || null,
    });
    
    if (originalTransaction.jid && originalTransaction.jid !== data.jid) {
        await updateJobSheetPaymentStatus(originalTransaction.jid, id);
    }
    if (data.jid) {
        await updateJobSheetPaymentStatus(data.jid);
    }

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

    revalidatePath('/non-invoicing');
    revalidatePath('/dashboard');
    revalidatePath('/reporting');
    revalidatePath('/admin');
    revalidatePath('/job-sheet');

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
    const jobSheetsQuery = query(collection(db, 'jobSheets'));


    const [allTransactionsSnapshot, dailyTransactionsSnapshot, jobSheetsSnapshot] = await Promise.all([
      getDocs(allTransactionsQuery),
      getDocs(dailyTransactionsQuery),
      getDocs(jobSheetsQuery),
    ]);

    const allTransactions = allTransactionsSnapshot.docs.map(doc => doc.data() as Transaction);
    const dailyTransactions = dailyTransactionsSnapshot.docs.map(doc => doc.data() as Transaction);
    const jobSheets = jobSheetsSnapshot.docs.map(doc => doc.data() as JobSheet);


    const dailyCash = dailyTransactions
      .filter(t => t.paymentMethod === 'Cash')
      .reduce((sum, t) => sum + t.paidAmount, 0);
    const dailyBank = dailyTransactions
      .filter(t => t.paymentMethod === 'Bank Transfer' || t.paymentMethod === 'ST Bank Transfer' || t.paymentMethod === 'AIR Bank Transfer')
      .reduce((sum, t) => sum + t.paidAmount, 0);
    const dailyCard = dailyTransactions
      .filter(t => t.paymentMethod === 'Card Payment')
      .reduce((sum, t) => sum + t.paidAmount, 0);

    const totalInputs = allTransactions.length;
    const cashAmount = allTransactions
      .filter((t) => t.paymentMethod === 'Cash')
      .reduce((sum, t) => sum + t.paidAmount, 0);
    const bankAmount = allTransactions
      .filter((t) => t.paymentMethod === 'Bank Transfer' || t.paymentMethod === 'ST Bank Transfer' || t.paymentMethod === 'AIR Bank Transfer')
      .reduce((sum, t) => sum + t.paidAmount, 0);
    const cardAmount = allTransactions
      .filter((t) => t.paymentMethod === 'Card Payment')
      .reduce((sum, t) => sum + t.paidAmount, 0);
    const totalSales = allTransactions.reduce((sum, t) => sum + t.paidAmount, 0);
    
    const productionCount = jobSheets.filter(js => js.status === 'Production').length;
    const holdCount = jobSheets.filter(js => js.status === 'Hold').length;
    const unpaidCount = jobSheets.filter(js => js.paymentStatus === 'Unpaid').length;
    const studioCount = jobSheets.filter(js => js.status === 'Studio').length;
    const mghCount = jobSheets.filter(js => js.status === 'MGH').length;

    return {
      totalSales,
      totalInputs,
      cashAmount,
      bankAmount,
      cardAmount,
      dailyCash,
      dailyBank,
      dailyCard,
      productionCount,
      holdCount,
      unpaidCount,
      studioCount,
      mghCount,
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
      productionCount: 0,
      holdCount: 0,
      unpaidCount: 0,
      studioCount: 0,
      mghCount: 0,
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

export async function getReportData({ searchTerm, startDate, endDate }: { searchTerm?: string, startDate?: string, endDate?: string }): Promise<Transaction[]> {
  try {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const querySnapshot = await getDocs(q);
    
    let transactions = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        date: (data.date as Timestamp).toDate(),
        createdAt: (data.createdAt as Timestamp)?.toDate(),
      } as Transaction;
    });

    if (startDate && endDate) {
      const start = startOfDay(new Date(startDate));
      const end = endOfDay(new Date(endDate));
      transactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= start && transactionDate <= end;
      });
    }

    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        
        // Check if the search term is a date
        const searchDate = parseISO(searchTerm);
        const isDateSearch = isValid(searchDate);

        transactions = transactions.filter(t => {
            if (isDateSearch) {
                const transactionDate = new Date(t.date);
                return transactionDate.toDateString() === searchDate.toDateString();
            }

            return (
                t.transactionId?.toLowerCase().includes(lowercasedTerm) ||
                t.jid?.toLowerCase().includes(lowercasedTerm) ||
                t.clientName?.toLowerCase().includes(lowercasedTerm)
            );
        });
    }
    
    return transactions;
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function searchTransactions(
  searchTerm: string,
  paymentMethod?: PaymentMethod
): Promise<Transaction[]> {
  try {
    const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(1000));
    const querySnapshot = await getDocs(q);

    let transactions = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        date: (data.date as Timestamp).toDate(),
        createdAt: (data.createdAt as Timestamp)?.toDate(),
      } as Transaction;
    });

    if (paymentMethod) {
      transactions = transactions.filter(t => t.paymentMethod === paymentMethod);
    }
    
    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      transactions = transactions.filter((t) => {
        const tidMatch = t.transactionId?.toLowerCase().includes(lowercasedTerm);
        const clientMatch = t.clientName?.toLowerCase().includes(lowercasedTerm);
        const jobMatch = t.jobDescription?.toLowerCase().includes(lowercasedTerm);
        const jidMatch = t.jid?.toLowerCase().includes(lowercasedTerm);
        return tidMatch || clientMatch || jobMatch || jidMatch;
      });
    }

    return transactions.slice(0, searchTerm || paymentMethod ? 1000 : 50);

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
        const transactionRef = doc(db, 'transactions', id);
        const transactionSnap = await getDoc(transactionRef);
        if (!transactionSnap.exists()) {
             return { success: false, message: 'Transaction not found.' };
        }
        const transactionData = transactionSnap.data() as Transaction;
        
        await deleteDoc(transactionRef);
        
        if (transactionData.jid) {
            await updateJobSheetPaymentStatus(transactionData.jid, id);
        }

        revalidatePath('/admin');
        revalidatePath('/reporting');
        revalidatePath('/dashboard');
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
        const jidsToUpdate = new Set<string>();

        for (const id of ids) {
            const docRef = doc(db, 'transactions', id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as Transaction;
                if (data.jid) {
                    jidsToUpdate.add(data.jid);
                }
                batch.delete(docRef);
            }
        }
        await batch.commit();

        for (const jid of jidsToUpdate) {
            await updateJobSheetPaymentStatus(jid);
        }


        revalidatePath('/admin');
        revalidatePath('/reporting');
        revalidatePath('/dashboard');
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
