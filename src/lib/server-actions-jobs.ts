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
  type QueryConstraint,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { JobSheet, Transaction, JobSheetStatus, PaymentStatus, Operator, JobSheetHistory, Quotation, QuotationStatus } from '@/lib/types';
import { JobSheetSchema } from '@/lib/types';
import { isValidOperator } from './server-actions-operators';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { addTransaction, getNextTransactionId } from './server-actions';
import { getLondonDateString, getLondonCurrentDate } from '@/lib/london-time';


const CreateJobSheetSchema = JobSheetSchema.omit({
  id: true,
  createdAt: true,
  jobId: true,
}).passthrough();

const UpdateJobSheetSchema = CreateJobSheetSchema.extend({
    tid: z.string().optional().nullable(),
});

// Helper to sanitize history for client-side serialization
const sanitizeHistory = (history?: any[]): JobSheetHistory[] => {
    return (history || []).map(h => {
        let ts = h.timestamp;
        if (ts && typeof ts.toDate === 'function') {
            ts = ts.toDate().toISOString();
        } else if (ts && typeof ts.seconds === 'number') {
            ts = new Date(ts.seconds * 1000).toISOString();
        } else if (ts instanceof Date) {
            ts = ts.toISOString();
        } else if (typeof ts === 'string') {
            ts = ts;
        } else {
            ts = new Date().toISOString();
        }
        return {
            ...h,
            timestamp: ts,
        };
    }) as JobSheetHistory[];
};

async function getNextJobId(): Promise<string> {
    const q = query(collection(db, 'jobSheets'), orderBy('jobId', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return 'JID0001';
    }

    const lastJobId = querySnapshot.docs[0].data().jobId as string;
    const lastNumber = parseInt(lastJobId.replace('JID', ''), 10);
    const newNumber = lastNumber + 1;
    return `JID${String(newNumber).padStart(4, '0')}`;
}


export async function addJobSheet(
  data: z.input<typeof CreateJobSheetSchema>,
  fromQuotation?: Quotation | null
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
    const newJobId = await getNextJobId();
    
    const { totalAmount, operator } = validatedData.data;

    const initialHistoryEntry: JobSheetHistory = {
        timestamp: Timestamp.now(),
        operator: operator,
        action: 'Created',
        details: fromQuotation 
            ? `Job sheet created from Quotation ${fromQuotation.quotationId} by ${operator}.`
            : `Job sheet created by ${operator}.`,
    };

    const keywords = generateSearchKeywords(
      newJobId,
      validatedData.data.clientName,
      validatedData.data.companyName,
      validatedData.data.clientDetails,
      validatedData.data.irNumber,
      validatedData.data.specialNote,
      validatedData.data.tid,
      validatedData.data.jobItems,
      validatedData.data.invoiceNumber
    );

    const dataToSave: any = {
      ...validatedData.data,
      jobId: newJobId,
      searchKeywords: keywords,
      date: Timestamp.fromDate(validatedData.data.date as Date),
      createdAt: serverTimestamp(),
      paidAmount: 0,
      dueAmount: totalAmount,
      paymentStatus: 'Unpaid',
      history: [initialHistoryEntry],
    };
    
    if (validatedData.data.tid) {
      dataToSave.tid = validatedData.data.tid;
    } else {
      dataToSave.tid = null;
    }

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
    
    // If created from quotation, update the quotation
    if (fromQuotation) {
        const quotationRef = doc(db, 'quotations', fromQuotation.id!);
        const quotationHistory = {
            timestamp: Timestamp.now(),
            operator: operator,
            action: 'Converted',
            details: `Converted to Job Sheet ${newJobId}.`,
        };
        await updateDoc(quotationRef, {
            jid: newJobId,
            status: 'Approved',
            history: [...(fromQuotation.history || []), quotationHistory]
        });
    }


    const newDocSnap = await getDoc(docRef);
    const newDocData = newDocSnap.data();

    let newJobSheet: JobSheet | null = null;
    if (newDocData) {
      newJobSheet = {
        ...(newDocData as Omit<JobSheet, 'id' | 'date' | 'createdAt' | 'deliveryBy' | 'history'>),
        id: docRef.id,
        jobId: newJobId,
        date: (newDocData.date as Timestamp).toDate(),
        deliveryBy: newDocData.deliveryBy ? (newDocData.deliveryBy as Timestamp).toDate() : null,
        createdAt: (newDocData.createdAt as Timestamp)?.toDate() || new Date(), 
        history: sanitizeHistory(newDocData.history),
      };
    }

    revalidatePath('/job-sheet');
    revalidatePath('/js-report');
    revalidatePath('/quotation-report');
    revalidatePath('/quotation');

    return { success: true, message: 'Job sheet added successfully.', jobSheet: newJobSheet };
  } catch (error) {
    console.error('Error adding job sheet:', error);
    return { success: false, message: error instanceof Error ? error.message : 'An unexpected error occurred.' };
  }
}

export async function updateJobSheet(
  id: string,
  data: z.input<typeof UpdateJobSheetSchema>,
  changeOperator: Operator
) {
  const validatedData = UpdateJobSheetSchema.safeParse(data);
  if (!validatedData.success) {
    return { success: false, message: 'Validation failed.', errors: validatedData.error.flatten().fieldErrors };
  }
  
  const isValid = await isValidOperator(changeOperator);
  if (!isValid) {
      return { success: false, message: 'Invalid operator performing the change.' };
  }

  try {
    const jobSheetRef = doc(db, 'jobSheets', id);
    const originalJobSheetSnap = await getDoc(jobSheetRef);
    if (!originalJobSheetSnap.exists()) {
        return { success: false, message: 'Job Sheet not found.' };
    }
    
    const originalData = originalJobSheetSnap.data();
    const originalJobSheet = {
        ...originalData,
        date: (originalData.date as Timestamp).toDate(),
        deliveryBy: originalData.deliveryBy ? (originalData.deliveryBy as Timestamp).toDate() : null,
    } as JobSheet;

    const newHistoryEntries: Omit<JobSheetHistory, 'timestamp'>[] = [];
    
    // Compare fields and generate history
    if (originalJobSheet.operator !== validatedData.data.operator) {
        newHistoryEntries.push({ operator: changeOperator, action: 'Updated', details: `Operator changed from '${originalJobSheet.operator}' to '${validatedData.data.operator}'.` });
    }
    if (format(originalJobSheet.date as Date, 'yyyy-MM-dd') !== format(validatedData.data.date as Date, 'yyyy-MM-dd')) {
        newHistoryEntries.push({ operator: changeOperator, action: 'Updated', details: `Date changed from '${format(originalJobSheet.date as Date, 'dd/MM/yyyy')}' to '${format(validatedData.data.date as Date, 'dd/MM/yyyy')}'.` });
    }
    if (originalJobSheet.status !== validatedData.data.status) {
        newHistoryEntries.push({ operator: changeOperator, action: 'Updated', details: `Status changed from '${originalJobSheet.status}' to '${validatedData.data.status}'.` });
    }
     if ((originalJobSheet.deliveryBy ? format(originalJobSheet.deliveryBy as Date, 'yyyy-MM-dd') : null) !== (validatedData.data.deliveryBy ? format(validatedData.data.deliveryBy as Date, 'yyyy-MM-dd') : null)) {
        newHistoryEntries.push({ operator: changeOperator, action: 'Updated', details: `Delivery date changed from '${originalJobSheet.deliveryBy ? format(originalJobSheet.deliveryBy as Date, 'dd/MM/yyyy') : 'N/A'}' to '${validatedData.data.deliveryBy ? format(validatedData.data.deliveryBy as Date, 'dd/MM/yyyy') : 'N/A'}'.` });
    }
    if (originalJobSheet.type !== validatedData.data.type) {
        newHistoryEntries.push({ operator: changeOperator, action: 'Updated', details: `Type changed from '${originalJobSheet.type}' to '${validatedData.data.type}'.` });
    }
     if (originalJobSheet.tid !== validatedData.data.tid) {
        newHistoryEntries.push({ operator: changeOperator, action: 'Updated', details: `Transaction ID changed from '${originalJobSheet.tid || 'none'}' to '${validatedData.data.tid || 'none'}'.` });
    }
     if (originalJobSheet.invoiceNumber !== validatedData.data.invoiceNumber) {
        newHistoryEntries.push({ operator: changeOperator, action: 'Updated', details: `Invoice number changed from '${originalJobSheet.invoiceNumber || 'none'}' to '${validatedData.data.invoiceNumber || 'none'}'.` });
    }
     if (JSON.stringify(originalJobSheet.jobItems) !== JSON.stringify(validatedData.data.jobItems)) {
        newHistoryEntries.push({ operator: changeOperator, action: 'Updated', details: 'Job items, quantities, or prices were modified.' });
    }


    const keywords = generateSearchKeywords(
      originalJobSheet.jobId,
      validatedData.data.clientName,
      validatedData.data.companyName,
      validatedData.data.clientDetails,
      validatedData.data.irNumber,
      validatedData.data.specialNote,
      validatedData.data.tid,
      validatedData.data.jobItems,
      validatedData.data.invoiceNumber
    );

    const dataToUpdate: any = {
        ...validatedData.data,
        searchKeywords: keywords,
        date: Timestamp.fromDate(validatedData.data.date as Date),
    };
    if (validatedData.data.tid) {
      dataToUpdate.tid = validatedData.data.tid;
    } else {
      dataToUpdate.tid = null;
    }

    if (validatedData.data.deliveryBy) {
        dataToUpdate.deliveryBy = Timestamp.fromDate(validatedData.data.deliveryBy as Date);
    } else {
        dataToUpdate.deliveryBy = null;
    }
    
    if (newHistoryEntries.length > 0) {
        const fullHistoryEntries = newHistoryEntries.map(entry => ({ ...entry, timestamp: Timestamp.now() }));
        dataToUpdate.history = [...(originalJobSheet.history || []), ...fullHistoryEntries];
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
    // If TID is being removed
    if (originalJobSheet.tid && !data.tid) {
       const q = query(collection(db, 'transactions'), where('transactionId', '==', originalJobSheet.tid));
       const querySnapshot = await getDocs(q);
       if (!querySnapshot.empty) {
            const txDoc = querySnapshot.docs[0];
            if (txDoc.data().jid === originalJobSheet.jobId) {
                await updateDoc(txDoc.ref, { jid: null });
            }
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
            ...(updatedData as Omit<JobSheet, 'id' | 'date' | 'createdAt' | 'deliveryBy' | 'history'>),
            id: updatedDoc.id,
            date: (updatedData.date as Timestamp).toDate(),
            deliveryBy: updatedData.deliveryBy ? (updatedData.deliveryBy as Timestamp).toDate() : null,
            createdAt: (updatedData.createdAt as Timestamp)?.toDate() || new Date(),
            history: sanitizeHistory(updatedData.history),
        };
    }
    return { success: true, message: 'Job sheet updated successfully.', jobSheet };
  } catch (error) {
    console.error('Error updating job sheet:', error);
    return { success: false, message: error instanceof Error ? error.message : 'An unexpected error occurred.' };
  }
}

function generateSearchKeywords(
  idStr?: string | null,
  clientName?: string | null,
  companyName?: string | null,
  clientDetails?: string | null,
  irNumber?: string | null,
  specialNote?: string | null,
  tid?: string | null,
  jobItems?: { description?: string }[],
  invoiceNumber?: string | null
): string[] {
  const keywords = new Set<string>();

  const addText = (text?: string | null, includePrefixes: boolean = true) => {
    if (!text) return;
    const clean = text.toLowerCase().trim();
    if (!clean) return;

    if (clean.length <= 50) {
      keywords.add(clean);
    }

    const words = clean.split(/[\s,.-]+/).filter(Boolean);
    words.forEach(w => {
      if (w.length < 2) return;
      keywords.add(w);
      if (includePrefixes) {
        for (let i = 2; i <= Math.min(w.length, 8); i++) {
          keywords.add(w.slice(0, i));
        }
      }
    });
  };

  if (idStr) {
    const idLower = idStr.toLowerCase();
    keywords.add(idLower);
    const cleanNum = idLower.replace(/\D/g, '');
    if (cleanNum) {
      keywords.add(cleanNum);
      keywords.add(cleanNum.padStart(4, '0'));
      keywords.add(String(parseInt(cleanNum, 10)));
    }
  }

  addText(clientName, true);
  addText(companyName, true);
  addText(irNumber, true);
  addText(invoiceNumber, true);
  addText(tid, true);

  addText(clientDetails, false);
  addText(specialNote, false);
  (jobItems || []).forEach(item => addText(item.description, false));

  return Array.from(keywords).slice(0, 150);
}

const mapDocToJobSheet = (docSnap: any): JobSheet => {
  const data = docSnap.data();
  return {
    ...(data as Omit<JobSheet, 'id' | 'date' | 'createdAt' | 'deliveryBy' | 'history'>),
    id: docSnap.id,
    date: data.date?.toDate ? data.date.toDate() : (data.date ? new Date(data.date) : new Date()),
    deliveryBy: data.deliveryBy?.toDate ? data.deliveryBy.toDate() : (data.deliveryBy ? new Date(data.deliveryBy) : null),
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
    history: sanitizeHistory(data.history),
  } as JobSheet;
};

const sortJobSheetsByDateDesc = (items: JobSheet[]): JobSheet[] => {
  return items.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    if (timeA !== timeB) return timeB - timeA;
    const numA = parseInt((a.jobId || '').replace(/\D/g, '') || '0', 10);
    const numB = parseInt((b.jobId || '').replace(/\D/g, '') || '0', 10);
    return numB - numA;
  });
};

export async function getAllJobSheets(): Promise<JobSheet[]> {
  try {
    const q = query(collection(db, 'jobSheets'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const list = snap.docs.map(mapDocToJobSheet);
    return sortJobSheetsByDateDesc(list);
  } catch (e) {
    console.error('Error fetching all job sheets:', e);
    return [];
  }
}

export async function searchJobSheets(
  searchTerm: string, 
  returnAllOnEmpty: boolean = false,
  jobStatus?: JobSheetStatus,
  paymentStatus?: PaymentStatus,
  operator?: Operator
): Promise<JobSheet[]> {
  try {
    const trimmedTerm = searchTerm.trim();

    // If no search term is entered, return records according to filters
    if (!trimmedTerm) {
      const constraints: QueryConstraint[] = [];
      if (jobStatus) constraints.push(where('status', '==', jobStatus));
      if (paymentStatus) constraints.push(where('paymentStatus', '==', paymentStatus));
      if (operator) constraints.push(where('operator', '==', operator));

      const q = returnAllOnEmpty
        ? query(collection(db, 'jobSheets'), ...constraints, orderBy('createdAt', 'desc'))
        : query(collection(db, 'jobSheets'), ...constraints, orderBy('createdAt', 'desc'), limit(100));

      const snap = await getDocs(q);
      const list = snap.docs.map(mapDocToJobSheet);
      return sortJobSheetsByDateDesc(list);
    }

    // Candidate JID variants for numeric & JID prefix searches (e.g., 0043, 43, 1319, JID0043, j1319)
    const candidateJids = new Set<string>();
    const cleanNum = trimmedTerm.replace(/\D/g, '');
    if (cleanNum) {
      const padded = cleanNum.padStart(4, '0');
      candidateJids.add(`JID${padded}`);
      candidateJids.add(`JID${cleanNum}`);
      candidateJids.add(`JID${parseInt(cleanNum, 10)}`);
    }
    if (/^[jJ]/i.test(trimmedTerm)) {
      candidateJids.add(trimmedTerm.toUpperCase());
    }

    const docMap = new Map<string, JobSheet>();
    const lowercasedTerm = trimmedTerm.toLowerCase();

    // 1. Direct fetch for exact candidate JIDs (Reads only matching 1 doc!)
    for (const candidateJid of candidateJids) {
      try {
        const jidQuery = query(
          collection(db, 'jobSheets'),
          where('jobId', '==', candidateJid)
        );
        const jidSnap = await getDocs(jidQuery);
        jidSnap.docs.forEach(doc => {
          docMap.set(doc.id, mapDocToJobSheet(doc));
        });
      } catch (err) {
        console.error('Error fetching candidate JID:', candidateJid, err);
      }
    }

    // 2. Indexed array-contains query for full term & search tokens (Reads ONLY matching docs!)
    const searchTokens = lowercasedTerm.split(/[\s,.-]+/).filter(Boolean);
    const queryTokens = new Set<string>();
    queryTokens.add(lowercasedTerm);
    searchTokens.forEach(t => {
      if (t.length >= 2) queryTokens.add(t);
    });

    for (const qToken of Array.from(queryTokens).slice(0, 3)) {
      try {
        const kwQuery = query(
          collection(db, 'jobSheets'),
          where('searchKeywords', 'array-contains', qToken),
          limit(100)
        );
        const kwSnap = await getDocs(kwQuery);
        kwSnap.docs.forEach(doc => {
          docMap.set(doc.id, mapDocToJobSheet(doc));
        });
      } catch (err) {
        console.error('Indexed keyword query check:', err);
      }
    }

    let results = Array.from(docMap.values());

    // Apply status and operator filters
    if (jobStatus) {
      results = results.filter(js => js.status === jobStatus);
    }
    if (paymentStatus) {
      results = results.filter(js => js.paymentStatus === paymentStatus);
    }
    if (operator) {
      results = results.filter(js => js.operator === operator);
    }

    // Perform multi-token partial & exact text search filtering
    results = results.filter((js) => {
      const jobIdLower = (js.jobId || '').toLowerCase();
      const clientLower = (js.clientName || '').toLowerCase();
      const companyLower = (js.companyName || '').toLowerCase();
      const detailsLower = (js.clientDetails || '').toLowerCase();
      const irLower = (js.irNumber || '').toLowerCase();
      const invoiceLower = (js.invoiceNumber || '').toLowerCase();
      const noteLower = (js.specialNote || '').toLowerCase();
      const tidLower = (js.tid || '').toLowerCase();
      const itemsText = (js.jobItems || [])
        .map(item => item.description || '')
        .join(' ')
        .toLowerCase();

      // Number / JID match check
      if (cleanNum) {
        const isJidMatch = candidateJids.has(js.jobId || '') ||
          jobIdLower.endsWith(cleanNum) ||
          jobIdLower.includes(cleanNum);
        if (isJidMatch) return true;
      }

      // Check if ALL search tokens match anywhere in the job sheet's text fields
      const combinedText = `${jobIdLower} ${clientLower} ${companyLower} ${detailsLower} ${irLower} ${invoiceLower} ${noteLower} ${tidLower} ${itemsText}`;
      return searchTokens.every(token => combinedText.includes(token));
    });

    return sortJobSheetsByDateDesc(results);
  } catch (e) {
    console.error('Error searching job sheets: ', e);
    return [];
  }
}

export async function deleteJobSheet(id: string) {
    if (!id) return { success: false, message: 'Job Sheet ID is required.' };
    
    const jobSheetRef = doc(db, 'jobSheets', id);
    try {
        const jobSheetSnap = await getDoc(jobSheetRef);
        if (!jobSheetSnap.exists()) {
            return { success: false, message: 'Job Sheet not found.' };
        }
        const jobSheetData = jobSheetSnap.data() as JobSheet;
        const jobId = jobSheetData.jobId;

        // Find and unlock the original quotation if it exists
        const quotationQuery = query(collection(db, 'quotations'), where('jid', '==', jobId), limit(1));
        const quotationSnapshot = await getDocs(quotationQuery);
        
        if (!quotationSnapshot.empty) {
            const quotationDoc = quotationSnapshot.docs[0];
            const quotationRef = quotationDoc.ref;
            const quotationData = quotationDoc.data() as Quotation;

            const historyEntry = {
                timestamp: Timestamp.now(),
                operator: 'System', 
                action: 'Unlocked',
                details: `Linked Job Sheet ${jobId} was deleted. Quotation is now unlocked and editable.`,
            };

            await updateDoc(quotationRef, {
                jid: null,
                status: 'Hold',
                history: [...(quotationData.history || []), historyEntry],
            });
        }

        await deleteDoc(jobSheetRef);
        
        revalidatePath('/job-sheet');
        revalidatePath('/js-report');
        revalidatePath('/quotation-report');
        return { success: true, message: 'Job sheet deleted successfully.' };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'An unexpected error occurred.' };
    }
}

export async function exportAllJobSheets(
  searchTerm?: string,
  jobStatus?: JobSheetStatus,
  paymentStatus?: PaymentStatus,
  operator?: Operator
): Promise<any[]> {
    try {
        const jobSheets = await searchJobSheets(searchTerm || '', true, jobStatus, paymentStatus, operator);

        if (jobSheets.length === 0) {
            return [];
        }

        return jobSheets.map(data => {
            const date = data.date ? new Date(data.date) : new Date();
            const deliveryBy = data.deliveryBy ? new Date(data.deliveryBy) : null;

            return {
                'Job ID': data.jobId,
                'Date': format(date, 'yyyy-MM-dd'),
                'Operator': data.operator,
                'Client Name': data.clientName,
                'Company Name': data.companyName,
                'Client Details': data.clientDetails,
                'Job Items': data.jobItems.map(item => `${item.quantity}x ${item.description} @ £${item.price.toFixed(2)} (VAT: ${item.vatApplied ? 'Yes' : 'No'})`).join('; '),
                'Sub-Total': data.subTotal.toFixed(2),
                'VAT Amount': data.vatAmount.toFixed(2),
                'Total Amount': data.totalAmount.toFixed(2),
                'Paid Amount': data.paidAmount.toFixed(2),
                'Due Amount': data.dueAmount.toFixed(2),
                'Job Status': data.status,
                'Payment Status': data.paymentStatus,
                'Special Note': data.specialNote,
                'IR Number': data.irNumber,
                'Invoice Number': data.invoiceNumber || '',
                'Delivery By': deliveryBy ? format(deliveryBy, 'yyyy-MM-dd') : 'N/A',
                'Type': data.type,
            };
        });
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
    operator: z.string().min(1, 'Operator is required'),
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

    // The addTransaction function will handle updating the job sheet
    const result = await addTransaction(transactionData);

    if (result.success && result.transaction) {
        return { success: true, transaction: result.transaction };
    }

    return { success: false, message: result.message || 'Failed to create transaction.' };
}

export async function getJobSheetByJobId(jobId: string): Promise<JobSheet | null> {
  if (!jobId) return null;

  try {
    const q = query(collection(db, 'jobSheets'), where('jobId', '==', jobId), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();
    return {
      ...(data as Omit<JobSheet, 'id' | 'date' | 'createdAt' | 'deliveryBy' | 'history'>),
      id: doc.id,
      date: (data.date as Timestamp).toDate(),
      deliveryBy: data.deliveryBy ? (data.deliveryBy as Timestamp).toDate() : null,
      createdAt: (data.createdAt as Timestamp)?.toDate(),
      history: sanitizeHistory(data.history),
    } as JobSheet;
  } catch (error) {
    console.error('Error fetching job sheet by JID:', error);
    return null;
  }
}

export async function backfillJobSheetSearchKeywords(): Promise<{ success: boolean; updatedCount: number }> {
  try {
    const snap = await getDocs(collection(db, 'jobSheets'));
    const unindexedDocs = snap.docs.filter(d => {
      const kw = d.data().searchKeywords;
      return !kw || !Array.isArray(kw) || kw.length === 0;
    });
    if (unindexedDocs.length === 0) return { success: true, updatedCount: 0 };

    let updatedCount = 0;
    for (let i = 0; i < unindexedDocs.length; i += 200) {
      const chunk = unindexedDocs.slice(i, i + 200);
      const batch = writeBatch(db);
      chunk.forEach(docSnap => {
        const data = docSnap.data();
        const keywords = generateSearchKeywords(
          data.jobId,
          data.clientName,
          data.companyName,
          data.clientDetails,
          data.irNumber,
          data.specialNote,
          data.tid,
          data.jobItems
        );
        batch.update(docSnap.ref, { searchKeywords: keywords });
      });
      await batch.commit();
      updatedCount += chunk.length;
    }
    return { success: true, updatedCount };
  } catch (err) {
    console.error('Error backfilling job sheet search keywords:', err);
    return { success: false, updatedCount: 0 };
  }
}

export async function createJobSheetFromTillLogs({
  transactionIds,
  paymentMethod,
  date,
  operator,
  clientName = 'Walking Client',
}: {
  transactionIds: string[];
  paymentMethod: string;
  date?: Date | string;
  operator: string;
  clientName?: string;
  autoPay?: boolean;
}): Promise<{ success: boolean; message: string; jobId?: string; jobSheet?: JobSheet; transactionId?: string }> {
  if (!transactionIds || transactionIds.length === 0) {
    return { success: false, message: 'No transactions selected to create Job Sheet.' };
  }

  try {
    const txDocs = await Promise.all(
      transactionIds.map(async (id) => {
        const txDoc = await getDoc(doc(db, 'transactions', id));
        if (txDoc.exists()) {
          return { id: txDoc.id, ...txDoc.data() } as any;
        }
        return null;
      })
    );
    const validTxs = txDocs.filter((d): d is NonNullable<typeof d> => d !== null);

    if (validTxs.length === 0) {
      return { success: false, message: 'Selected transactions could not be found.' };
    }

    // Collect existing TIDs
    const linkedTids = validTxs.map((t) => t.transactionId).filter(Boolean);
    const tidString = linkedTids.join(', ');

    // Map items from transactions
    const jobItems = validTxs.map((tx) => {
      const qty = Number(tx.quantity) > 0 ? Number(tx.quantity) : 1;
      const linePrice = Number(tx.amount) || 0;
      return {
        description: tx.jobDescription || 'Till Sale',
        quantity: qty,
        price: linePrice,
        vatApplied: Boolean(tx.vatApplied),
      };
    });

    // Compute financial totals
    let subTotal = 0;
    let vatableSubTotal = 0;
    jobItems.forEach((item) => {
      subTotal += item.price;
      if (item.vatApplied) {
        vatableSubTotal += item.price;
      }
    });

    const vatAmount = Number((vatableSubTotal * 0.20).toFixed(2));
    const totalAmount = Number((subTotal + vatAmount).toFixed(2));

    // Next Job ID
    const newJobId = await getNextJobId();

    // Determine type
    let jobType: 'Invoice' | 'STR' | 'AIR' = 'Invoice';
    if (paymentMethod.includes('ST')) {
      jobType = 'STR';
    } else if (paymentMethod.includes('AIR')) {
      jobType = 'AIR';
    }

    const dateObj = date
      ? typeof date === 'string'
        ? new Date(date)
        : date
      : new Date();

    const initialHistoryEntry: JobSheetHistory = {
      timestamp: Timestamp.now(),
      operator: operator || 'PTTill',
      action: 'Created',
      details: `Auto-generated from ${validTxs.length} Till ${paymentMethod} sales. Marked Paid (Linked TIDs: ${tidString || 'N/A'}).`,
    };

    const finalClientName = clientName && clientName.trim() ? clientName.trim() : 'Walking Client';
    const clientDetails = `Till Sales - ${paymentMethod} (${format(dateObj, 'dd/MM/yyyy')})`;

    const keywords = generateSearchKeywords(
      newJobId,
      finalClientName,
      null,
      clientDetails,
      null,
      null,
      tidString,
      jobItems,
      null
    );

    const dataToSave: any = {
      jobId: newJobId,
      tid: tidString || null,
      clientName: finalClientName,
      companyName: null,
      clientDetails: clientDetails,
      jobItems: jobItems,
      subTotal: subTotal,
      discountType: 'amount',
      discountValue: 0,
      discountAmount: 0,
      subTotalAfterDiscount: subTotal,
      vatAmount: vatAmount,
      totalAmount: totalAmount,
      paidAmount: totalAmount,
      dueAmount: 0,
      status: 'Ready Pickup',
      paymentStatus: 'Paid',
      specialNote: `Till ${paymentMethod} batch - ${validTxs.length} sales. Linked TIDs: ${tidString || 'N/A'}.`,
      irNumber: null,
      deliveryBy: null,
      type: jobType,
      operator: operator || 'PTMGH',
      date: Timestamp.fromDate(dateObj),
      createdAt: serverTimestamp(),
      searchKeywords: keywords,
      history: [initialHistoryEntry],
    };

    // Save Job Sheet
    const jobSheetRef = await addDoc(collection(db, 'jobSheets'), dataToSave);

    // Update each transaction in transactions collection with the new JID
    const batch = writeBatch(db);
    validTxs.forEach((tx) => {
      const targetRef = doc(db, 'transactions', tx.id);
      batch.update(targetRef, {
        jid: newJobId,
      });
    });
    await batch.commit();

    revalidatePath('/job-sheet');
    revalidatePath('/js-report');
    revalidatePath('/non-invoicing');
    revalidatePath('/dashboard');
    revalidatePath('/reporting');
    revalidatePath('/admin');

    const createdSnap = await getDoc(jobSheetRef);
    const createdData = createdSnap.data();

    let createdJobSheet: JobSheet | undefined;
    if (createdData) {
      createdJobSheet = {
        ...createdData,
        id: jobSheetRef.id,
        date: (createdData.date as Timestamp)?.toDate
          ? (createdData.date as Timestamp).toDate()
          : new Date(),
        history: sanitizeHistory(createdData.history),
      } as JobSheet;
    }

    return {
      success: true,
      message: `Job Sheet ${newJobId} created and marked as Paid for ${validTxs.length} items (Linked TIDs: ${tidString || 'N/A'}).`,
      jobId: newJobId,
      jobSheet: createdJobSheet,
      transactionId: tidString || undefined,
    };
  } catch (err) {
    console.error('Error creating Job Sheet from Till logs:', err);
    return {
      success: false,
      message:
        err instanceof Error
          ? err.message
          : 'Failed to create Job Sheet from Till logs.',
    };
  }
}

/**
 * Automatically creates Paid Job Sheets for all unassigned Till sales for a target London day.
 * STRICT REQUIREMENT: Job Sheets are created only against "Walking Client".
 */
export async function autoCreateAllPendingTillJids({
  targetDate,
  operator = 'PTTill (Auto)',
}: {
  targetDate?: Date | string;
  operator?: string;
} = {}): Promise<{
  success: boolean;
  message: string;
  createdJobs: Array<{ jobId: string; paymentMethod: string; count: number; total: number }>;
}> {
  try {
    const targetDateObj = targetDate
      ? typeof targetDate === 'string'
        ? new Date(targetDate)
        : targetDate
      : getLondonCurrentDate();

    const targetLondonDayStr = getLondonDateString(targetDateObj);

    // Query broad range around this target date (+/- 24h)
    const localStart = new Date(targetDateObj.getFullYear(), targetDateObj.getMonth(), targetDateObj.getDate(), 0, 0, 0, 0);
    const localEnd = new Date(targetDateObj.getFullYear(), targetDateObj.getMonth(), targetDateObj.getDate(), 23, 59, 59, 999);
    const queryStart = Timestamp.fromDate(new Date(localStart.getTime() - 24 * 3600 * 1000));
    const queryEnd = Timestamp.fromDate(new Date(localEnd.getTime() + 24 * 3600 * 1000));

    const q = query(
      collection(db, 'transactions'),
      where('date', '>=', queryStart),
      where('date', '<=', queryEnd)
    );

    const snapshot = await getDocs(q);
    const unassignedTxs: Transaction[] = [];

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.type !== 'non-invoicing') return;
      if (data.jid && data.jid.trim() !== '') return;

      const tDate = (data.date as Timestamp)?.toDate
        ? (data.date as Timestamp).toDate()
        : (data.date ? new Date(data.date) : new Date());

      // Match London calendar day
      if (getLondonDateString(tDate) === targetLondonDayStr) {
        unassignedTxs.push({
          ...data,
          id: docSnap.id,
          date: tDate,
        } as Transaction);
      }
    });

    if (unassignedTxs.length === 0) {
      return {
        success: true,
        message: `No unassigned till sales found for London date ${targetLondonDayStr}.`,
        createdJobs: [],
      };
    }

    // Group by payment method
    const paymentMethodsList = ['Cash', 'Card Payment', 'Bank Transfer', 'ST Bank Transfer', 'AIR Bank Transfer'];
    const createdJobs: Array<{ jobId: string; paymentMethod: string; count: number; total: number }> = [];

    for (const method of paymentMethodsList) {
      const methodTxs = unassignedTxs.filter((t) => t.paymentMethod === method);
      if (methodTxs.length === 0) continue;

      const txIds = methodTxs.map((t) => t.id).filter((id): id is string => Boolean(id));
      const methodTotal = methodTxs.reduce((sum, t) => sum + (Number(t.paidAmount) || Number(t.totalAmount) || 0), 0);

      // Create JID strictly for "Walking Client"
      const result = await createJobSheetFromTillLogs({
        transactionIds: txIds,
        paymentMethod: method,
        date: targetDateObj,
        operator,
        clientName: 'Walking Client',
      });

      if (result.success && result.jobId) {
        createdJobs.push({
          jobId: result.jobId,
          paymentMethod: method,
          count: txIds.length,
          total: methodTotal,
        });
      }
    }

    revalidatePath('/job-sheet');
    revalidatePath('/js-report');
    revalidatePath('/non-invoicing');
    revalidatePath('/reporting');
    revalidatePath('/dashboard');

    const summaryText = createdJobs
      .map((j) => `${j.jobId} (${j.paymentMethod}: ${j.count} items, £${j.total.toFixed(2)})`)
      .join(', ');

    return {
      success: true,
      message: createdJobs.length > 0
        ? `Auto-created ${createdJobs.length} Job Sheet(s) for Walking Client: ${summaryText}.`
        : 'All transactions for this day already have JIDs assigned.',
      createdJobs,
    };
  } catch (err) {
    console.error('Error in autoCreateAllPendingTillJids:', err);
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to auto-create Job Sheets from Till logs.',
      createdJobs: [],
    };
  }
}

/**
 * Self-healing sweep: checks any past London days (before today) for unassigned till transactions
 * and automatically groups them into Paid Job Sheets for "Walking Client".
 */
export async function sweepPreviousDaysUnassignedTill(): Promise<{
  success: boolean;
  totalCreated: number;
  message: string;
}> {
  try {
    const todayLondonStr = getLondonDateString(new Date());

    // Fetch transactions from the past 7 days
    const pastLimit = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 3600 * 1000));
    const q = query(
      collection(db, 'transactions'),
      where('date', '>=', pastLimit),
      orderBy('date', 'asc')
    );

    const snap = await getDocs(q);
    const unassignedPastDays = new Map<string, Transaction[]>();

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.type !== 'non-invoicing') return;
      if (data.jid && data.jid.trim() !== '') return;

      const tDate = (data.date as Timestamp)?.toDate
        ? (data.date as Timestamp).toDate()
        : (data.date ? new Date(data.date) : new Date());

      const txLondonDay = getLondonDateString(tDate);
      // Strictly past London calendar days (before today)
      if (txLondonDay < todayLondonStr) {
        if (!unassignedPastDays.has(txLondonDay)) {
          unassignedPastDays.set(txLondonDay, []);
        }
        unassignedPastDays.get(txLondonDay)!.push({
          ...data,
          id: docSnap.id,
          date: tDate,
        } as Transaction);
      }
    });

    let totalCreated = 0;
    for (const [dayStr] of unassignedPastDays.entries()) {
      const [y, m, d] = dayStr.split('-').map(Number);
      const dayDate = new Date(y, m - 1, d, 12, 0, 0);

      const res = await autoCreateAllPendingTillJids({
        targetDate: dayDate,
        operator: 'PTTill (Auto Sweep)',
      });

      if (res.success) {
        totalCreated += res.createdJobs.length;
      }
    }

    return {
      success: true,
      totalCreated,
      message: totalCreated > 0
        ? `Auto-sweep completed: created ${totalCreated} past Job Sheet(s) for Walking Client.`
        : 'No unassigned past till transactions found.',
    };
  } catch (err) {
    console.error('Error in sweepPreviousDaysUnassignedTill:', err);
    return {
      success: false,
      totalCreated: 0,
      message: err instanceof Error ? err.message : 'Error sweeping past till transactions.',
    };
  }
}



