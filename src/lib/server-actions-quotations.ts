
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
import type { Quotation, Transaction, JobSheetStatus as QuotationStatus, PaymentStatus, Operator, QuotationHistory, JobSheet } from '@/lib/types';
import { QuotationSchema, operators } from '@/lib/types';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { addJobSheet } from './server-actions-jobs';


const CreateQuotationSchema = QuotationSchema.omit({
  id: true,
  quotationId: true,
  createdAt: true,
}).passthrough();

const UpdateQuotationSchema = CreateQuotationSchema.extend({
    tid: z.string().optional().nullable(),
});

// Helper to sanitize history for client-side serialization
const sanitizeHistory = (history?: any[]): QuotationHistory[] => {
    return (history || []).map(h => ({
        ...h,
        timestamp: h.timestamp instanceof Timestamp ? h.timestamp.toDate() : h.timestamp,
    }));
};

async function getNextQuotationId(): Promise<string> {
    const q = query(collection(db, 'quotations'), orderBy('quotationId', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return 'QU0001';
    }

    const lastQuotationId = querySnapshot.docs[0].data().quotationId as string;
    const lastNumber = parseInt(lastQuotationId.replace('QU', ''), 10);
    const newNumber = lastNumber + 1;
    return `QU${String(newNumber).padStart(4, '0')}`;
}


export async function addQuotation(
  data: z.infer<typeof CreateQuotationSchema>
) {
  const validatedData = CreateQuotationSchema.safeParse(data);
  if (!validatedData.success) {
    return {
      success: false,
      message: validatedData.error.flatten().fieldErrors.jobItems?.[0] || 'Validation failed.',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }

  try {
    const newQuotationId = await getNextQuotationId();

    const initialHistoryEntry: QuotationHistory = {
        timestamp: Timestamp.now(),
        operator: validatedData.data.operator,
        action: 'Created',
        details: `Quotation created by ${validatedData.data.operator}.`,
    };

    const dataToSave: any = {
      ...validatedData.data,
      quotationId: newQuotationId,
      date: Timestamp.fromDate(validatedData.data.date as Date),
      createdAt: serverTimestamp(),
      paidAmount: 0,
      dueAmount: validatedData.data.totalAmount,
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
          await updateDoc(txDoc.ref, { jid: newQuotationId });
      }
    }
    
    const docRef = await addDoc(collection(db, 'quotations'), dataToSave);

    const newDocSnap = await getDoc(docRef);
    const newDocData = newDocSnap.data();

    let newQuotation: Quotation | null = null;
    if (newDocData) {
      newQuotation = {
        ...(newDocData as Omit<Quotation, 'id' | 'date' | 'createdAt' | 'deliveryBy' | 'history'>),
        id: docRef.id,
        quotationId: newDocData.quotationId,
        date: (newDocData.date as Timestamp).toDate(),
        deliveryBy: newDocData.deliveryBy ? (newDocData.deliveryBy as Timestamp).toDate() : null,
        createdAt: (newDocData.createdAt as Timestamp)?.toDate() || new Date(), 
        history: sanitizeHistory(newDocData.history),
      };
    }

    revalidatePath('/quotation');
    revalidatePath('/quotation-report');
    return { success: true, message: 'Quotation added successfully.', quotation: newQuotation };
  } catch (error) {
    console.error('Error adding quotation:', error);
    return { success: false, message: error instanceof Error ? error.message : 'An unexpected error occurred.' };
  }
}

export async function updateQuotation(
  id: string,
  data: z.infer<typeof UpdateQuotationSchema>,
  changeOperator: Operator
) {
  const validatedData = UpdateQuotationSchema.safeParse(data);
  if (!validatedData.success) {
    return { success: false, message: 'Validation failed.', errors: validatedData.error.flatten().fieldErrors };
  }
  
  if (!operators.includes(changeOperator)) {
      return { success: false, message: 'Invalid operator performing the change.' };
  }

  try {
    const quotationRef = doc(db, 'quotations', id);
    const originalQuotationSnap = await getDoc(quotationRef);
    if (!originalQuotationSnap.exists()) {
        return { success: false, message: 'Quotation not found.' };
    }
    
    const originalData = originalQuotationSnap.data();
    const originalQuotation = {
        ...originalData,
        date: (originalData.date as Timestamp).toDate(),
        deliveryBy: originalData.deliveryBy ? (originalData.deliveryBy as Timestamp).toDate() : null,
    } as Quotation;

    const newHistoryEntries: Omit<QuotationHistory, 'timestamp'>[] = [];
    
    // Compare fields and generate history for explicit changes
    if (originalQuotation.operator !== validatedData.data.operator) {
        newHistoryEntries.push({ operator: changeOperator, action: 'Updated', details: `Operator changed from '${originalQuotation.operator}' to '${validatedData.data.operator}'.` });
    }
    if (format(originalQuotation.date as Date, 'yyyy-MM-dd') !== format(validatedData.data.date as Date, 'yyyy-MM-dd')) {
        newHistoryEntries.push({ operator: changeOperator, action: 'Updated', details: `Date changed from '${format(originalQuotation.date as Date, 'dd/MM/yyyy')}' to '${format(validatedData.data.date as Date, 'dd/MM/yyyy')}'.` });
    }
    if (originalQuotation.status !== validatedData.data.status) {
        newHistoryEntries.push({ operator: changeOperator, action: 'Updated', details: `Status changed from '${originalQuotation.status}' to '${validatedData.data.status}'.` });
    }
     if ((originalQuotation.deliveryBy ? format(originalQuotation.deliveryBy as Date, 'yyyy-MM-dd') : null) !== (validatedData.data.deliveryBy ? format(validatedData.data.deliveryBy as Date, 'yyyy-MM-dd') : null)) {
        newHistoryEntries.push({ operator: changeOperator, action: 'Updated', details: `Delivery date changed from '${originalQuotation.deliveryBy ? format(originalQuotation.deliveryBy as Date, 'dd/MM/yyyy') : 'N/A'}' to '${validatedData.data.deliveryBy ? format(validatedData.data.deliveryBy as Date, 'dd/MM/yyyy')}'.` });
    }
    if (originalQuotation.type !== validatedData.data.type) {
        newHistoryEntries.push({ operator: changeOperator, action: 'Updated', details: `Type changed from '${originalQuotation.type}' to '${validatedData.data.type}'.` });
    }
     if (originalQuotation.tid !== validatedData.data.tid) {
        newHistoryEntries.push({ operator: changeOperator, action: 'Updated', details: `Transaction ID changed from '${originalQuotation.tid || 'none'}' to '${validatedData.data.tid || 'none'}'.` });
    }
     if (JSON.stringify(originalQuotation.jobItems) !== JSON.stringify(validatedData.data.jobItems)) {
        newHistoryEntries.push({ operator: changeOperator, action: 'Updated', details: 'Quotation items, quantities, or prices were modified.' });
    }


    const dataToUpdate: any = {
        ...validatedData.data,
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
        dataToUpdate.history = [...(originalQuotation.history || []), ...fullHistoryEntries];
    }
    
    // If TID is being added or changed
    if (data.tid && data.tid !== originalQuotation.tid) {
      const q = query(collection(db, 'transactions'), where('transactionId', '==', data.tid));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const txDoc = querySnapshot.docs[0];
        await updateDoc(txDoc.ref, { jid: originalQuotation.quotationId });
      }
    }
    // If TID is being removed
    if (originalQuotation.tid && !data.tid) {
       const q = query(collection(db, 'transactions'), where('transactionId', '==', originalQuotation.tid));
       const querySnapshot = await getDocs(q);
       if (!querySnapshot.empty) {
            const txDoc = querySnapshot.docs[0];
            if (txDoc.data().jid === originalQuotation.quotationId) {
                await updateDoc(txDoc.ref, { jid: null });
            }
       }
    }
    
    await updateDoc(quotationRef, dataToUpdate);
    
    revalidatePath('/quotation');
    revalidatePath('/quotation-report');
    const updatedDoc = await getDoc(quotationRef);
    const updatedData = updatedDoc.data();
     let quotation: Quotation | null = null;
    if (updatedData) {
        quotation = {
            ...(updatedData as Omit<Quotation, 'id' | 'date' | 'createdAt' | 'deliveryBy' | 'history'>),
            id: updatedDoc.id,
            date: (updatedData.date as Timestamp).toDate(),
            deliveryBy: updatedData.deliveryBy ? (updatedData.deliveryBy as Timestamp).toDate() : null,
            createdAt: (updatedData.createdAt as Timestamp)?.toDate() || new Date(),
            history: sanitizeHistory(updatedData.history),
        };
    }
    return { success: true, message: 'Quotation updated successfully.', quotation };
  } catch (error) {
    console.error('Error updating quotation:', error);
    return { success: false, message: error instanceof Error ? error.message : 'An unexpected error occurred.' };
  }
}

export async function searchQuotations(
  searchTerm: string, 
  returnAllOnEmpty: boolean = false,
  quotationStatus?: QuotationStatus,
  operator?: Operator
): Promise<Quotation[]> {
  try {
    const q = query(collection(db, 'quotations'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    let quotations = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...(data as Omit<Quotation, 'id' | 'date' | 'createdAt' | 'deliveryBy' | 'history'>),
        id: doc.id,
        date: (data.date as Timestamp).toDate(),
        deliveryBy: data.deliveryBy ? (data.deliveryBy as Timestamp).toDate() : null,
        createdAt: (data.createdAt as Timestamp)?.toDate(),
        history: sanitizeHistory(data.history),
      } as Quotation;
    });

    if (quotationStatus) {
      quotations = quotations.filter(js => js.status === quotationStatus);
    }
    if (operator) {
      quotations = quotations.filter(js => js.operator === operator);
    }

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      quotations = quotations.filter((js) => {
        return (
          js.quotationId?.toLowerCase().includes(lowercasedTerm) ||
          js.clientName?.toLowerCase().includes(lowercasedTerm) ||
          js.companyName?.toLowerCase().includes(lowercasedTerm) ||
          js.jobItems.some(item => item.description?.toLowerCase().includes(lowercasedTerm))
        );
      });
    }

    if (returnAllOnEmpty && !searchTerm && !quotationStatus && !operator) {
        return quotations;
    }
    
    // if any filter is applied, return all matches, otherwise limit to 50
    if (searchTerm || quotationStatus || operator) {
      return quotations;
    }

    return quotations.slice(0, 50);
  } catch (e) {
    console.error('Error searching quotations: ', e);
    return [];
  }
}

export async function deleteQuotation(id: string) {
    if (!id) return { success: false, message: 'Quotation ID is required.' };
    try {
        await deleteDoc(doc(db, 'quotations', id));
        revalidatePath('/quotation');
        revalidatePath('/quotation-report');
        return { success: true, message: 'Quotation deleted successfully.' };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'An unexpected error occurred.' };
    }
}

export async function exportAllQuotations(
  searchTerm?: string,
  quotationStatus?: QuotationStatus,
  operator?: Operator
): Promise<any[]> {
    try {
        const quotations = await searchQuotations(searchTerm || '', true, quotationStatus, operator);

        if (quotations.length === 0) {
            return [];
        }

        return quotations.map(data => {
            const date = data.date ? new Date(data.date) : new Date();
            const deliveryBy = data.deliveryBy ? new Date(data.deliveryBy) : null;

            return {
                'Quotation ID': data.quotationId,
                'Date': format(date, 'yyyy-MM-dd'),
                'Operator': data.operator,
                'Client Name': data.clientName,
                'Company Name': data.companyName,
                'Client Details': data.clientDetails,
                'Items': data.jobItems.map(item => `${item.quantity}x ${item.description} @ £${item.price.toFixed(2)} (VAT: ${item.vatApplied ? 'Yes' : 'No'})`).join('; '),
                'Sub-Total': data.subTotal.toFixed(2),
                'VAT Amount': data.vatAmount.toFixed(2),
                'Total Amount': data.totalAmount.toFixed(2),
                'Status': data.status,
                'Special Note': data.specialNote,
                'JID': data.jid,
                'Delivery By': deliveryBy ? format(deliveryBy, 'yyyy-MM-dd') : 'N/A',
                'Type': data.type,
            };
        });
    } catch (e) {
        console.error('Error exporting quotations:', e);
        return [];
    }
}

export async function getQuotationByQuotationId(quotationId: string): Promise<Quotation | null> {
  if (!quotationId) return null;

  try {
    const q = query(collection(db, 'quotations'), where('quotationId', '==', quotationId), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();
    return {
      ...(data as Omit<Quotation, 'id' | 'date' | 'createdAt' | 'deliveryBy' | 'history'>),
      id: doc.id,
      date: (data.date as Timestamp).toDate(),
      deliveryBy: data.deliveryBy ? (data.deliveryBy as Timestamp).toDate() : null,
      createdAt: (data.createdAt as Timestamp)?.toDate(),
      history: sanitizeHistory(data.history),
    } as Quotation;
  } catch (error) {
    console.error('Error fetching quotation by ID:', error);
    return null;
  }
}

export async function createJobSheetFromQuotation(quotationId: string): Promise<{success: boolean, message: string, jobSheet?: JobSheet}> {
    if (!quotationId) {
        return { success: false, message: 'Quotation ID is required.' };
    }

    try {
        const quotationRef = doc(db, 'quotations', quotationId);
        const quotationSnap = await getDoc(quotationRef);

        if (!quotationSnap.exists()) {
            return { success: false, message: 'Quotation not found.' };
        }

        const quotationData = quotationSnap.data() as Quotation;
        
        // Construct the job sheet data meticulously
        const jobSheetDataForCreation = {
            date: new Date(),
            operator: quotationData.operator,
            clientName: quotationData.clientName,
            companyName: quotationData.companyName || null,
            clientDetails: quotationData.clientDetails || null,
            jobItems: quotationData.jobItems,
            subTotal: quotationData.subTotal,
            vatAmount: quotationData.vatAmount,
            totalAmount: quotationData.totalAmount,
            paidAmount: 0,
            dueAmount: quotationData.totalAmount,
            status: 'Hold' as const,
            paymentStatus: 'Unpaid' as const,
            specialNote: `Converted from Quotation ${quotationData.quotationId}.\n\n${quotationData.specialNote || ''}`,
            irNumber: null,
            deliveryBy: quotationData.deliveryBy ? new Date(quotationData.deliveryBy as any) : null,
            type: 'Invoice' as const,
        };
        
        const result = await addJobSheet(jobSheetDataForCreation);

        if (result.success && result.jobSheet) {
            const historyEntry = {
                timestamp: Timestamp.now(),
                operator: quotationData.operator,
                action: 'Converted',
                details: `Converted to Job Sheet ${result.jobSheet.jobId}.`,
            };
            
            await updateDoc(quotationRef, {
                status: 'Approved',
                jid: result.jobSheet.jobId,
                history: [...(quotationData.history || []), historyEntry],
            });

            revalidatePath('/quotation');
            revalidatePath('/quotation-report');
            revalidatePath('/job-sheet');
            revalidatePath('/js-report');
            
            return { success: true, message: `Job Sheet ${result.jobSheet.jobId} created successfully.`, jobSheet: result.jobSheet };
        } else {
            return { success: false, message: result.message || 'Failed to create Job Sheet.' };
        }

    } catch (error) {
        console.error('Error creating job sheet from quotation:', error);
        return { success: false, message: error instanceof Error ? error.message : 'An unexpected error occurred.' };
    }
}
