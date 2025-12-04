

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
  QueryConstraint,
  getCountFromServer,
  getAggregateFromServer,
  sum
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

async function getNextTransactionId(): Promise<string> {
    const q = query(collection(db, 'transactions'), orderBy('transactionId', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return 'TID0001';
    }

    const lastId = querySnapshot.docs[0].data().transactionId as string;
    const lastNumber = parseInt(lastId.replace('TID', ''), 10);
    const newNumber = lastNumber + 1;
    return `TID${String(newNumber).padStart(4, '0')}`;
}

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
    const newTransactionId = await getNextTransactionId();
    
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

    let newTransaction: Transaction | null = null;
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

    const allTransactionsQuery = collection(db, 'transactions');
    const dailyTransactionsQuery = query(
        allTransactionsQuery,
        where('date', '>=', Timestamp.fromDate(todayStart)),
        where('date', '<=', Timestamp.fromDate(todayEnd))
    );
    const jobSheetsQuery = collection(db, 'jobSheets');

    const [
        totalInputsSnap,
        dailyCashSnap,
        dailyBankSnap,
        dailyCardSnap,
        totalSalesSnap,
        cashAmountSnap,
        bankAmountSnap,
        cardAmountSnap,
        jobSheetsSnapshot, // Fetch all job sheets once
    ] = await Promise.all([
        getCountFromServer(allTransactionsQuery),
        getAggregateFromServer(query(dailyTransactionsQuery, where('paymentMethod', '==', 'Cash')), { dailyCash: sum('paidAmount') }),
        getAggregateFromServer(query(dailyTransactionsQuery, where('paymentMethod', 'in', ['Bank Transfer', 'ST Bank Transfer', 'AIR Bank Transfer'])), { dailyBank: sum('paidAmount') }),
        getAggregateFromServer(query(dailyTransactionsQuery, where('paymentMethod', '==', 'Card Payment')), { dailyCard: sum('paidAmount') }),
        getAggregateFromServer(allTransactionsQuery, { totalSales: sum('paidAmount') }),
        getAggregateFromServer(query(allTransactionsQuery, where('paymentMethod', '==', 'Cash')), { cashAmount: sum('paidAmount') }),
        getAggregateFromServer(query(allTransactionsQuery, where('paymentMethod', 'in', ['Bank Transfer', 'ST Bank Transfer', 'AIR Bank Transfer'])), { bankAmount: sum('paidAmount') }),
        getAggregateFromServer(query(allTransactionsQuery, where('paymentMethod', '==', 'Card Payment')), { cardAmount: sum('paidAmount') }),
        getDocs(jobSheetsQuery),
    ]);

    const jobSheets = jobSheetsSnapshot.docs.map(doc => doc.data() as JobSheet);

    // Process job sheets counts locally
    const productionCount = jobSheets.filter(js => js.status === 'Production').length;
    const holdCount = jobSheets.filter(js => js.status === 'Hold').length;
    const unpaidCount = jobSheets.filter(js => js.paymentStatus === 'Unpaid').length;
    const studioCount = jobSheets.filter(js => js.status === 'Studio').length;
    const mghCount = jobSheets.filter(js => js.status === 'MGH').length;
    const cancelCount = jobSheets.filter(js => js.status === 'Cancel').length;
    const readyPickupCount = jobSheets.filter(js => js.status === 'Ready Pickup').length;
    const parcelCompareCount = jobSheets.filter(js => js.status === 'Parcel Compare').length;
    const deliveredCount = jobSheets.filter(js => js.status === 'Delivered').length;


    return {
      totalSales: totalSalesSnap.data().totalSales,
      totalInputs: totalInputsSnap.data().count,
      cashAmount: cashAmountSnap.data().cashAmount,
      bankAmount: bankAmountSnap.data().bankAmount,
      cardAmount: cardAmountSnap.data().cardAmount,
      dailyCash: dailyCashSnap.data().dailyCash,
      dailyBank: dailyBankSnap.data().dailyBank,
      dailyCard: dailyCardSnap.data().dailyCard,
      productionCount,
      holdCount,
      unpaidCount,
      studioCount,
      mghCount,
      cancelCount,
      readyPickupCount,
      parcelCompareCount,
      deliveredCount,
    };
  } catch (e) {
    console.error('Error fetching dashboard stats:', e);
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
      cancelCount: 0,
      readyPickupCount: 0,
      parcelCompareCount: 0,
      deliveredCount: 0,
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
    const constraints: QueryConstraint[] = [orderBy('date', 'desc')];
    if (startDate && endDate) {
        constraints.push(where('date', '>=', Timestamp.fromDate(new Date(startDate))));
        constraints.push(where('date', '<=', Timestamp.fromDate(new Date(endDate))));
    }

    const q = query(collection(db, 'transactions'), ...constraints);
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
    
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        
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
    
    // Augment with Job Sheet data
    const jids = transactions.map(tx => tx.jid).filter((jid): jid is string => !!jid);
    if (jids.length > 0) {
        const uniqueJids = [...new Set(jids)];
        // Firestore 'in' queries are limited to 30 items. We need to chunk.
        const jidChunks = [];
        for (let i = 0; i < uniqueJids.length; i += 30) {
            jidChunks.push(uniqueJids.slice(i, i + 30));
        }

        const jobSheetMap = new Map<string, JobSheet>();
        
        for (const chunk of jidChunks) {
            const jobSheetQuery = query(collection(db, 'jobSheets'), where('jobId', 'in', chunk));
            const jobSheetsSnapshot = await getDocs(jobSheetQuery);
            jobSheetsSnapshot.docs.forEach(doc => {
                const data = doc.data() as JobSheet;
                jobSheetMap.set(data.jobId, data);
            });
        }
        
        return transactions.map(tx => {
            if (tx.jid && jobSheetMap.has(tx.jid)) {
                const jobSheet = jobSheetMap.get(tx.jid)!;
                return {
                    ...tx,
                    invoiceNumber: tx.invoiceNumber || jobSheet.invoiceNumber || jobSheet.irNumber || '',
                };
            }
            return tx;
        });
    }


    return transactions;
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function searchTransactions(
  searchTerm?: string,
  paymentMethod?: PaymentMethod
): Promise<Transaction[]> {
  try {
    const baseQuery = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(baseQuery);

    let allTransactions = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        date: (data.date as Timestamp).toDate(),
        createdAt: (data.createdAt as Timestamp)?.toDate(),
      } as Transaction;
    });

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      allTransactions = allTransactions.filter((t) => {
        const tidMatch = t.transactionId?.toLowerCase().includes(lowercasedTerm);
        const clientMatch = t.clientName?.toLowerCase().includes(lowercasedTerm);
        const jobMatch = t.jobDescription?.toLowerCase().includes(lowercasedTerm);
        const jidMatch = t.jid?.toLowerCase().includes(lowercasedTerm);
        return tidMatch || clientMatch || jobMatch || jidMatch;
      });
    }

    return allTransactions;
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
