
'use server';

import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
  getDocs,
  getDoc,
  orderBy,
  query,
  updateDoc,
  doc,
  deleteDoc,
  where,
  limit,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { CompanyProfile, Invoice, InvoiceStatus } from '@/lib/types';
import { CompanyProfileSchema, InvoiceSchema } from '@/lib/types';
import { db } from '@/lib/firebase';

const CreateCompanyProfileSchema = CompanyProfileSchema.omit({ id: true, createdAt: true });
const CreateInvoiceSchema = InvoiceSchema.omit({ id: true, invoiceId: true, createdAt: true });

// --- Company Profile Actions ---

export async function saveCompanyProfile(
  data: z.infer<typeof CreateCompanyProfileSchema> & { id?: string }
) {
  const validatedData = CreateCompanyProfileSchema.safeParse(data);
  if (!validatedData.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }

  try {
    if (data.id) {
      // Update existing
      const profileRef = doc(db, 'companyProfiles', data.id);
      await updateDoc(profileRef, validatedData.data);
    } else {
      // Create new
      await addDoc(collection(db, 'companyProfiles'), {
        ...validatedData.data,
        createdAt: serverTimestamp(),
      });
    }
    revalidatePath('/invoice-generator');
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'An error occurred.' };
  }
}

export async function getCompanyProfiles(): Promise<CompanyProfile[]> {
  try {
    const q = query(collection(db, 'companyProfiles'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
    })) as CompanyProfile[];
  } catch (e) {
    console.error('Error fetching company profiles:', e);
    return [];
  }
}

export async function deleteCompanyProfile(id: string) {
    try {
        await deleteDoc(doc(db, 'companyProfiles', id));
        revalidatePath('/invoice-generator');
        return { success: true };
    } catch (error) {
        return { success: false, message: 'Could not delete profile. Invoices may still be associated with it.' };
    }
}


// --- Invoice Actions ---

async function getNextInvoiceId(): Promise<string> {
    const counterRef = doc(db, 'counters', 'invoices');
    const newCount = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists()) {
            transaction.set(counterRef, { count: 1 });
            return 1;
        }
        const newCount = counterDoc.data().count + 1;
        transaction.update(counterRef, { count: newCount });
        return newCount;
    });
    return `Inv-${String(newCount).padStart(5, '0')}`;
}

export async function saveInvoice(
  data: z.infer<typeof CreateInvoiceSchema> & { id?: string }
) {
  const validatedData = CreateInvoiceSchema.safeParse(data);
  if (!validatedData.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }

  const dataToSave = {
      ...validatedData.data,
      date: Timestamp.fromDate(validatedData.data.date as Date),
      dueDate: Timestamp.fromDate(validatedData.data.dueDate as Date),
  };

  try {
    if (data.id) {
      // Update existing
      const invoiceRef = doc(db, 'invoices', data.id);
      await updateDoc(invoiceRef, dataToSave);
    } else {
      // Create new
      const newInvoiceId = await getNextInvoiceId();
      await addDoc(collection(db, 'invoices'), {
        ...dataToSave,
        invoiceId: newInvoiceId,
        createdAt: serverTimestamp(),
      });
    }
    revalidatePath('/invoice-generator');
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'An error occurred.' };
  }
}

export async function getInvoices(): Promise<Invoice[]> {
    try {
        const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: (data.date as Timestamp).toDate(),
                dueDate: (data.dueDate as Timestamp).toDate(),
            } as Invoice;
        });
    } catch(e) {
        console.error('Error fetching invoices:', e);
        return [];
    }
}

export async function deleteInvoice(id: string) {
    try {
        await deleteDoc(doc(db, 'invoices', id));
        revalidatePath('/invoice-generator');
        return { success: true };
    } catch (error) {
        return { success: false, message: 'Could not delete invoice.' };
    }
}

export async function setInvoiceStatus(id: string, status: InvoiceStatus) {
    try {
        const invoiceRef = doc(db, 'invoices', id);
        await updateDoc(invoiceRef, { status });
        revalidatePath('/invoice-generator');
        return { success: true };
    } catch (error) {
        return { success: false, message: 'Could not update invoice status.' };
    }
}

    