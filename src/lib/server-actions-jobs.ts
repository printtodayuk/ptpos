
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
  writeBatch
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { JobSheet, Transaction } from '@/lib/types';
import { JobSheetSchema } from '@/lib/types';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { addTransaction } from './server-actions';


const CreateJobSheetSchema = JobSheetSchema.omit({
  id: true,
  jobId: true,
  createdAt: true,
});

const UpdateJobSheetSchema = CreateJobSheetSchema.extend({
    tid: z.string().optional().nullable(),
});

export async function addJobSheet(
  data: z.infer<typeof CreateJobSheetSchema>
) {
  const validatedData = CreateJobSheetSchema.safeParse(data);
  if (!validatedData.success) {
    return {
      success: false,
      message: validatedData.error.flatten().fieldErrors.jobItems?.[0] || 'Validation failed.',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }

  try {
    const counterRef = doc(db, 'counters', 'jobSheets');
    
    const newJobId = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      const currentCount = counterDoc.exists() ? counterDoc.data()?.count : 0;
      const newCount = (currentCount || 0) + 1;
      transaction.set(counterRef, { count: newCount }, { merge: true });
      return `JID${String(newCount).padStart(4, '0')}`;
    });

    const dataToSave: any = {
      ...validatedData.data,
      jobId: newJobId,
      date: Timestamp.fromDate(validatedData.data.date as Date),
      createdAt: serverTimestamp(),
      tid: validatedData.data.tid || null,
    };

    if (validatedData.data.deliveryBy) {
      dataToSave.deliveryBy = Timestamp.fromDate(validatedData.data.deliveryBy as Date);
    } else {
      dataToSave.deliveryBy = null;
    }

    if (data.tid) {
      const q = query(collection(db, 'transactions'), where('transactionId', '==', data.tid));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
          const txDoc = querySnapshot.docs[0];
          await updateDoc(txDoc.ref, { jid: newJobId });
      }
    }
    
    const docRef = await addDoc(collection(db, 'jobSheets'), dataToSave);

    const newDocSnap = await getDoc(docRef);
    const newDocData = newDocSnap.data();

    let newJobSheet: JobSheet | null = null;
    if (newDocData) {
      newJobSheet = {
        ...(newDocData as Omit<JobSheet, 'id' | 'date' | 'createdAt' | 'deliveryBy'>),
        id: docRef.id,
        jobId: newJobId,
        date: (newDocData.date as Timestamp).toDate(),
        deliveryBy: newDocData.deliveryBy ? (newDocData.deliveryBy as Timestamp).toDate() : null,
        createdAt: (newDocData.createdAt as Timestamp)?.toDate() || new Date(), 
      };
    }

    revalidatePath('/job-sheet');
    revalidatePath('/js-report');
    return { success: true, message: 'Job sheet added successfully.', jobSheet: newJobSheet };
  } catch (error) {
    console.error('Error adding job sheet:', error);
    return { success: false, message: error instanceof Error ? error.message : 'An unexpected error occurred.' };
  }
}

export async function updateJobSheet(
  id: string,
  data: z.infer<typeof UpdateJobSheetSchema>
) {
  const validatedData = UpdateJobSheetSchema.safeParse(data);
  if (!validatedData.success) {
    return { success: false, message: 'Validation failed.', errors: validatedData.error.flatten().fieldErrors };
  }
  
  try {
    const jobSheetRef = doc(db, 'jobSheets', id);
    const originalJobSheetSnap = await getDoc(jobSheetRef);
    const originalJobSheet = originalJobSheetSnap.data() as JobSheet;

    const dataToUpdate: any = {
        ...validatedData.data,
        date: Timestamp.fromDate(validatedData.data.date as Date),
        operator: data.operator, // Make sure operator is updated
        tid: validatedData.data.tid || null,
    };

    if (validatedData.data.deliveryBy) {
        dataToUpdate.deliveryBy = Timestamp.fromDate(validatedData.data.deliveryBy as Date);
    } else {
        dataToUpdate.deliveryBy = null;
    }
    
    // If TID is being added or changed
    if (data.tid && data.tid !== originalJobSheet.tid) {
      const q = query(collection(db, 'transactions'), where('transactionId', '==', data.tid));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const txDoc = querySnapshot.docs[0];
        await updateDoc(txDoc.ref, { jid: originalJobSheet.jobId });
      }
    }
    
    await updateDoc(jobSheetRef, dataToUpdate);
    
    revalidatePath('/job-sheet');
    revalidatePath('/js-report');
    const updatedDoc = await getDoc(jobSheetRef);
    const updatedData = updatedDoc.data();
     let jobSheet: JobSheet | null = null;
    if (updatedData) {
        jobSheet = {
            ...(updatedData as Omit<JobSheet, 'id' | 'date' | 'createdAt' | 'deliveryBy'>),
            id: updatedDoc.id,
            date: (updatedData.date as Timestamp).toDate(),
            deliveryBy: updatedData.deliveryBy ? (updatedData.deliveryBy as Timestamp).toDate() : null,
            createdAt: (updatedData.createdAt as Timestamp)?.toDate() || new Date(),
        };
    }
    return { success: true, message: 'Job sheet updated successfully.', jobSheet };
  } catch (error) {
    console.error('Error updating job sheet:', error);
    return { success: false, message: error instanceof Error ? error.message : 'An unexpected error occurred.' };
  }
}

export async function searchJobSheets(searchTerm: string, returnAllOnEmpty: boolean = false): Promise<JobSheet[]> {
  try {
    const q = query(collection(db, 'jobSheets'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    let jobSheets = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        date: (data.date as Timestamp).toDate(),
        deliveryBy: data.deliveryBy ? (data.deliveryBy as Timestamp).toDate() : null,
        createdAt: (data.createdAt as Timestamp)?.toDate(),
      } as JobSheet;
    });

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      jobSheets = jobSheets.filter((js) => {
        return (
          js.jobId?.toLowerCase().includes(lowercasedTerm) ||
          js.clientName?.toLowerCase().includes(lowercasedTerm) ||
          js.jobItems.some(item => item.description?.toLowerCase().includes(lowercasedTerm))
        );
      });
    }

    if (returnAllOnEmpty && !searchTerm) {
        return jobSheets;
    }

    return jobSheets.slice(0, 50);
  } catch (e) {
    console.error('Error searching job sheets: ', e);
    return [];
  }
}

export async function deleteJobSheet(id: string) {
    if (!id) return { success: false, message: 'Job Sheet ID is required.' };
    try {
        await deleteDoc(doc(db, 'jobSheets', id));
        revalidatePath('/job-sheet');
        revalidatePath('/js-report');
        return { success: true, message: 'Job sheet deleted successfully.' };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'An unexpected error occurred.' };
    }
}

export async function exportAllJobSheets(): Promise<any[]> {
    try {
        const q = query(collection(db, 'jobSheets'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return [];
        }

        const jobSheets = querySnapshot.docs.map(doc => {
            const data = doc.data() as Omit<JobSheet, 'date' | 'deliveryBy'> & { date: Timestamp, deliveryBy: Timestamp | null, createdAt: Timestamp };
            
            const date = data.date ? data.date.toDate() : new Date();
            const deliveryBy = data.deliveryBy ? data.deliveryBy.toDate() : null;

            return {
                'Job ID': data.jobId,
                'Date': format(date, 'yyyy-MM-dd'),
                'Operator': data.operator,
                'Client Name': data.clientName,
                'Client Details': data.clientDetails,
                'Job Items': data.jobItems.map(item => `${item.quantity}x ${item.description} @ £${item.price.toFixed(2)} (VAT: ${item.vatApplied ? 'Yes' : 'No'})`).join('; '),
                'Sub-Total': data.subTotal.toFixed(2),
                'VAT Amount': data.vatAmount.toFixed(2),
                'Total Amount': data.totalAmount.toFixed(2),
                'Status': data.status,
                'Special Note': data.specialNote,
                'IR Number': data.irNumber,
                'Delivery By': deliveryBy ? format(deliveryBy, 'yyyy-MM-dd') : 'N/A',
                'Type': data.type,
            };
        });
        return jobSheets;
    } catch (e) {
        console.error('Error exporting job sheets:', e);
        return [];
    }
}

const PaymentDataSchema = z.object({
    jid: z.string(),
    clientName: z.string(),
    jobDescription: z.string().optional().nullable(),
    totalAmount: z.number(),
    paidAmount: z.coerce.number().min(0, 'Paid amount cannot be negative'),
    dueAmount: z.number(),
    paymentMethod: z.enum(['Bank Transfer', 'Card Payment', 'Cash', 'ST Bank Transfer', 'AIR Bank Transfer']),
    operator: z.enum(['PTMGH', 'PTASAD', 'PTM', 'PTITAdmin', 'PTASH', 'PTRK']),
    reference: z.string().optional().nullable(),
    date: z.date(),
});


export async function addTransactionFromJobSheet(jobSheet: JobSheet, data: z.infer<typeof PaymentDataSchema>) {
    const validatedData = PaymentDataSchema.safeParse(data);
    if (!validatedData.success) {
        return { success: false, message: 'Validation failed.', errors: validatedData.error.flatten().fieldErrors };
    }

    const transactionData = {
        type: 'non-invoicing' as const, // Always PT Till
        amount: jobSheet.subTotal,
        vatApplied: jobSheet.vatAmount > 0,
        ...validatedData.data,
    };

    const result = await addTransaction(transactionData);

    if (result.success && result.transaction) {
        const jobSheetRef = doc(db, 'jobSheets', jobSheet.id!);
        await updateDoc(jobSheetRef, { tid: result.transaction.transactionId });

        revalidatePath('/job-sheet');
        revalidatePath('/js-report');

        return { success: true, transaction: result.transaction };
    }

    return { success: false, message: result.message || 'Failed to create transaction.' };
}
