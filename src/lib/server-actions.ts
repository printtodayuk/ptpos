










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
import type { Transaction, PaymentMethod, JobSheet, PaymentStatus, Quotation } from '@/lib/types';
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

export async function getNextTransactionId(): Promise<string> {
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

export const CreateTillLogSchema = z.object({
  date: z.union([z.date(), z.string()]),
  clientName: z.string().min(1, 'Client name is required'),
  jobDescription: z.string().min(1, 'Job description is required'),
  quantity: z.coerce.number().min(1).default(1),
  unitPrice: z.coerce.number().min(0).default(0),
  amount: z.coerce.number().min(0),
  vatApplied: z.boolean().default(false),
  totalAmount: z.number(),
  paidAmount: z.number().default(0),
  dueAmount: z.number().default(0),
  paymentMethod: z.enum(paymentMethods),
  operator: z.string().min(1, 'Operator is required'),
  reference: z.string().optional().nullable(),
  jid: z.string().optional().nullable(),
  tid: z.string().optional().nullable(),
});

export async function addTillLog(data: z.input<typeof CreateTillLogSchema>) {
  const validated = CreateTillLogSchema.safeParse(data);
  if (!validated.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: validated.error.flatten().fieldErrors,
    };
  }

  try {
    const dateInput = validated.data.date;
    const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);

    const docRef = await addDoc(collection(db, 'tillLogs'), {
      ...validated.data,
      date: Timestamp.fromDate(dateObj),
      createdAt: serverTimestamp(),
      jid: null,
      tid: null,
    });

    const newSnap = await getDoc(docRef);
    const raw = newSnap.data();

    let tillLog: any = null;
    if (raw) {
      tillLog = {
        ...raw,
        id: docRef.id,
        transactionId: null, // No TID for individual till log until JID is batched/paid!
        date: (raw.date as Timestamp)?.toDate ? (raw.date as Timestamp).toDate() : new Date(raw.date),
        createdAt: (raw.createdAt as Timestamp)?.toDate ? (raw.createdAt as Timestamp).toDate() : new Date(),
      };
    }

    revalidatePath('/non-invoicing');
    return { success: true, message: 'Sale logged to Till.', tillLog };
  } catch (error) {
    console.error('Error adding till log:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Failed to add till log.' };
  }
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

    const newDueAmount = parseFloat((jobSheetData.totalAmount - totalPaid).toFixed(2));
    
    let newPaymentStatus: PaymentStatus = 'Unpaid';
    if (newDueAmount <= 0) {
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
  data: z.input<typeof CreateTransactionSchema>
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
    
    const dateInput = validatedData.data.date;
    const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);

    const docRef = await addDoc(collection(db, 'transactions'), {
      ...validatedData.data,
      transactionId: newTransactionId,
      date: Timestamp.fromDate(dateObj),
      createdAt: serverTimestamp(),
      adminChecked: false,
      checkedBy: null,
      jid: validatedData.data.jid || null,
    });
    
    if (data.jid) {
        await updateJobSheetPaymentStatus(data.jid);

        // Also update any matching tillLogs with this new TID
        try {
          const tillQuery = query(collection(db, 'tillLogs'), where('jid', '==', data.jid));
          const tillSnap = await getDocs(tillQuery);
          if (!tillSnap.empty) {
            const b = writeBatch(db);
            tillSnap.docs.forEach((d) => {
              b.update(d.ref, { tid: newTransactionId });
            });
            await b.commit();
          }
        } catch (err) {
          console.error('Error linking tillLogs to transaction:', err);
        }
    }

    const newDocSnap = await getDoc(docRef);
    const newDocData = newDocSnap.data();

    let newTransaction: Transaction | null = null;
    if (newDocData) {
      newTransaction = {
        ...(newDocData as Omit<Transaction, 'id' | 'date' | 'createdAt'>),
        id: docRef.id,
        transactionId: newTransactionId,
        date: (newDocData.date as Timestamp)?.toDate ? (newDocData.date as Timestamp).toDate() : new Date(newDocData.date),
        createdAt: (newDocData.createdAt as Timestamp)?.toDate ? (newDocData.createdAt as Timestamp).toDate() : new Date(), 
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
  data: z.input<typeof UpdateTransactionSchema>
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
    const jobSheetsRef = collection(db, 'jobSheets');
    const quotationsRef = collection(db, 'quotations');

    const getJobCount = async (status: string) => {
      const q = query(jobSheetsRef, where('status', '==', status));
      const snap = await getCountFromServer(q);
      return snap.data().count;
    };

    const getQuotationCount = async (status: string) => {
      const q = query(quotationsRef, where('status', '==', status));
      const snap = await getCountFromServer(q);
      return snap.data().count;
    };

    const [
      productionCount,
      finishingCount,
      holdCount,
      studioCount,
      mghCount,
      cancelCount,
      readyPickupCount,
      parcelCompareCount,
      deliveredCount,
      osCount,
      sentCount,
      quotationHoldCount,
      wfrCount,
      approvedCount,
      declinedCount,
    ] = await Promise.all([
      getJobCount('Production'),
      getJobCount('Finishing'),
      getJobCount('Hold'),
      getJobCount('Studio'),
      getJobCount('MGH'),
      getJobCount('Cancel'),
      getJobCount('Ready Pickup'),
      getJobCount('Parcel Compare'),
      getJobCount('Delivered'),
      getJobCount('OS'),
      getQuotationCount('Sent'),
      getQuotationCount('Hold'),
      getQuotationCount('WFR'),
      getQuotationCount('Approved'),
      getQuotationCount('Declined'),
    ]);

    return {
      productionCount,
      finishingCount,
      holdCount,
      studioCount,
      mghCount,
      cancelCount,
      readyPickupCount,
      parcelCompareCount,
      deliveredCount,
      osCount,
      sentCount,
      quotationHoldCount,
      wfrCount,
      approvedCount,
      declinedCount,
    };
  } catch (e) {
    console.error('Error fetching dashboard stats:', e);
    return {
      productionCount: 0,
      finishingCount: 0,
      holdCount: 0,
      studioCount: 0,
      mghCount: 0,
      cancelCount: 0,
      readyPickupCount: 0,
      parcelCompareCount: 0,
      deliveredCount: 0,
      osCount: 0,
      sentCount: 0,
      quotationHoldCount: 0,
      wfrCount: 0,
      approvedCount: 0,
      declinedCount: 0,
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
    const fetchLimit = startDate && endDate ? 300 : (searchTerm ? 100 : 50);
    let querySnapshot;
    try {
      const constraints: QueryConstraint[] = [orderBy('date', 'desc'), limit(fetchLimit)];
      if (startDate && endDate) {
          constraints.unshift(where('date', '>=', Timestamp.fromDate(new Date(startDate))), where('date', '<=', Timestamp.fromDate(new Date(endDate))));
      }
      const q = query(collection(db, 'transactions'), ...constraints);
      querySnapshot = await getDocs(q);
    } catch (err) {
      const fallbackQ = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(fetchLimit));
      querySnapshot = await getDocs(fallbackQ);
    }
    
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

export async function getAllTransactions(): Promise<Transaction[]> {
  try {
    const q = query(
      collection(db, 'transactions'),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);

    let allTransactions = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        date: (data.date as Timestamp).toDate(),
        createdAt: (data.createdAt as Timestamp)?.toDate(),
      } as Transaction;
    });

    const jids = allTransactions.map(tx => tx.jid).filter((jid): jid is string => !!jid);
    if (jids.length > 0) {
      const uniqueJids = [...new Set(jids)];
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
          if (data.jobId) jobSheetMap.set(data.jobId, data);
        });
      }

      return allTransactions.map(tx => {
        if (tx.jid && jobSheetMap.has(tx.jid)) {
          const jobSheet = jobSheetMap.get(tx.jid)!;
          return {
            ...tx,
            invoiceNumber: tx.invoiceNumber || jobSheet.irNumber || '',
          };
        }
        return tx;
      });
    }

    return allTransactions;
  } catch (e) {
    console.error('Error fetching all transactions: ', e);
    return [];
  }
}

export async function searchTransactions(
  searchTerm?: string,
  paymentMethod?: PaymentMethod,
  returnAllOnEmpty: boolean = true
): Promise<Transaction[]> {
  try {
    const trimmedTerm = (searchTerm || '').trim();
    const isIdSearch = trimmedTerm.length > 0 && /^(tid|jid)/i.test(trimmedTerm);

    let querySnapshot;
    if (isIdSearch) {
      const upperTerm = trimmedTerm.toUpperCase();
      const isJid = upperTerm.startsWith('JID');
      const targetField = isJid ? 'jid' : 'transactionId';
      try {
        const q = query(
          collection(db, 'transactions'),
          where(targetField, '>=', upperTerm),
          where(targetField, '<=', upperTerm + '\uf8ff')
        );
        querySnapshot = await getDocs(q);
      } catch (err) {
        const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
        querySnapshot = await getDocs(q);
      }
    } else {
      const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
      querySnapshot = await getDocs(q);
    }

    let allTransactions = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        date: (data.date as Timestamp).toDate(),
        createdAt: (data.createdAt as Timestamp)?.toDate(),
      } as Transaction;
    });

    let filteredTransactions = allTransactions;

    if (paymentMethod) {
      filteredTransactions = filteredTransactions.filter(
        (t) => t.paymentMethod === paymentMethod
      );
    }

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      filteredTransactions = filteredTransactions.filter((t) => {
        const tidMatch = t.transactionId?.toLowerCase().includes(lowercasedTerm);
        const clientMatch = t.clientName?.toLowerCase().includes(lowercasedTerm);
        const jobMatch = t.jobDescription?.toLowerCase().includes(lowercasedTerm);
        const jidMatch = t.jid?.toLowerCase().includes(lowercasedTerm);
        return tidMatch || clientMatch || jobMatch || jidMatch;
      });
    }
    
    const jids = filteredTransactions.map(tx => tx.jid).filter((jid): jid is string => !!jid);
    if (jids.length > 0) {
        const uniqueJids = [...new Set(jids)];
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
                if (data.jobId) jobSheetMap.set(data.jobId, data);
            });
        }
        
        return filteredTransactions.map(tx => {
            if (tx.jid && jobSheetMap.has(tx.jid)) {
                const jobSheet = jobSheetMap.get(tx.jid)!;
                return {
                    ...tx,
                    invoiceNumber: tx.invoiceNumber || jobSheet.irNumber || '',
                };
            }
            return tx;
        });
    }

    return filteredTransactions;
  } catch (e) {
    console.error('Error searching transactions: ', e);
    return [];
  }
}


export async function deleteTransaction(id: string) {
    if (!id) {
        return { success: false, message: 'ID is required.' };
    }
    try {
        // 1. Check if it is in tillLogs
        const tillLogRef = doc(db, 'tillLogs', id);
        const tillLogSnap = await getDoc(tillLogRef);
        if (tillLogSnap.exists()) {
            await deleteDoc(tillLogRef);
            revalidatePath('/non-invoicing');
            return { success: true, message: 'Till entry deleted successfully.' };
        }

        // 2. Otherwise check transactions
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

export async function getTillStats() {
    try {
        const now = new Date();
        const start = startOfDay(now);
        const end = endOfDay(now);

        // Broad query range (+/- 6h) so timezone shifts don't clip any entries
        const queryStart = new Date(start.getTime() - 6 * 3600 * 1000);
        const queryEnd = new Date(end.getTime() + 6 * 3600 * 1000);

        // 1. Query tillLogs
        const tillLogsQuery = query(
            collection(db, 'tillLogs'),
            where('date', '>=', queryStart),
            where('date', '<=', queryEnd)
        );
        const tillSnap = await getDocs(tillLogsQuery);

        // 2. Query legacy transactions
        const legacyQuery = query(
            collection(db, 'transactions'),
            where('date', '>=', queryStart),
            where('date', '<=', queryEnd)
        );
        const legacySnap = await getDocs(legacyQuery);

        let dailySales = 0;
        let cashTotal = 0;
        let cardTotal = 0;
        let bankTotal = 0;
        const processedIds = new Set<string>();

        const processDoc = (docSnap: any, isLegacy: boolean) => {
            const data = docSnap.data();
            if (isLegacy && data.type !== 'non-invoicing') return;
            if (processedIds.has(docSnap.id)) return;
            processedIds.add(docSnap.id);

            const tDate = (data.date as Timestamp)?.toDate 
                ? (data.date as Timestamp).toDate() 
                : (data.date ? new Date(data.date) : new Date());

            const isToday = 
                tDate.getFullYear() === now.getFullYear() && 
                tDate.getMonth() === now.getMonth() && 
                tDate.getDate() === now.getDate();

            const isTodayUTC = 
                tDate.getUTCFullYear() === now.getUTCFullYear() && 
                tDate.getUTCMonth() === now.getUTCMonth() && 
                tDate.getUTCDate() === now.getUTCDate();

            if (isToday || isTodayUTC) {
                const amount = Number(data.paidAmount) || Number(data.totalAmount) || 0;
                dailySales += amount;
                if (data.paymentMethod === 'Cash') {
                    cashTotal += amount;
                } else if (data.paymentMethod === 'Card Payment') {
                    cardTotal += amount;
                } else if (['Bank Transfer', 'ST Bank Transfer', 'AIR Bank Transfer'].includes(data.paymentMethod)) {
                    bankTotal += amount;
                }
            }
        };

        tillSnap.docs.forEach(d => processDoc(d, false));
        legacySnap.docs.forEach(d => processDoc(d, true));

        return {
            success: true,
            dailySales,
            cashTotal,
            cardTotal,
            bankTotal,
        };
    } catch (e) {
        console.error("Error fetching till stats: ", e);
        return {
            success: false,
            dailySales: 0,
            cashTotal: 0,
            cardTotal: 0,
            bankTotal: 0,
        };
    }
}

export async function getTillTransactionsByDate(
    targetDate: Date | string
): Promise<Transaction[]> {
    try {
        const dateObj = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
        const y = dateObj.getFullYear();
        const m = dateObj.getMonth();
        const d = dateObj.getDate();

        const localStart = new Date(y, m, d, 0, 0, 0, 0);
        const localEnd = new Date(y, m, d, 23, 59, 59, 999);

        // Broad query range (+/- 6h) to ensure no timezone edge-cases are missed in Firestore
        const queryStart = new Date(localStart.getTime() - 6 * 3600 * 1000);
        const queryEnd = new Date(localEnd.getTime() + 6 * 3600 * 1000);

        // 1. Query tillLogs collection
        const tillLogsQuery = query(
            collection(db, 'tillLogs'),
            where('date', '>=', queryStart),
            where('date', '<=', queryEnd)
        );
        const tillSnap = await getDocs(tillLogsQuery);

        // 2. Query legacy transactions collection for non-invoicing entries
        const legacyQuery = query(
            collection(db, 'transactions'),
            where('date', '>=', queryStart),
            where('date', '<=', queryEnd)
        );
        const legacySnap = await getDocs(legacyQuery);

        const list: Transaction[] = [];
        const processedIds = new Set<string>();

        const processDoc = (docSnap: any, isTillLog: boolean) => {
            const data = docSnap.data();
            if (!isTillLog && data.type !== 'non-invoicing') return;
            if (processedIds.has(docSnap.id)) return;
            processedIds.add(docSnap.id);

            const tDate = (data.date as Timestamp)?.toDate 
                ? (data.date as Timestamp).toDate() 
                : (data.date ? new Date(data.date) : new Date());

            const sameDayLocal = 
                tDate.getFullYear() === y && 
                tDate.getMonth() === m && 
                tDate.getDate() === d;

            const sameDayUTC = 
                tDate.getUTCFullYear() === dateObj.getUTCFullYear() && 
                tDate.getUTCMonth() === dateObj.getUTCMonth() && 
                tDate.getUTCDate() === dateObj.getUTCDate();

            if (sameDayLocal || sameDayUTC) {
                list.push({
                    ...data,
                    id: docSnap.id,
                    type: 'non-invoicing',
                    transactionId: data.tid || data.transactionId || null,
                    date: tDate,
                    createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate() : new Date(),
                } as Transaction);
            }
        };

        tillSnap.docs.forEach(d => processDoc(d, true));
        legacySnap.docs.forEach(d => processDoc(d, false));

        // Sort descending by date / time
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return list;
    } catch (e) {
        console.error('Error fetching till transactions by date:', e);
        return [];
    }
}
    
