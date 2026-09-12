
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
  runTransaction,
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
    return snapshot.docs.map(doc => {
        const data = doc.data();
        const createdAt = data.createdAt;
        return {
            ...data,
            id: doc.id,
            createdAt: createdAt?.toDate ? createdAt.toDate().toISOString() : (createdAt ? String(createdAt) : null),
        } as CompanyProfile;
    });
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

export function getCompanyInitials(name: string): string {
  if (!name) return 'INV';
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (lower.includes('sign today')) return 'ST';
  if (lower.includes('today ai')) return 'TA';
  if (lower.includes('print today')) return 'PT';
  
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.map(w => w[0].toUpperCase()).join('');
  }
  return trimmed.slice(0, 3).toUpperCase();
}

async function getNextInvoiceId(companyProfileId?: string): Promise<string> {
  let prefix = 'INV';
  if (companyProfileId) {
    try {
      const profileDoc = await getDoc(doc(db, 'companyProfiles', companyProfileId));
      if (profileDoc.exists()) {
        const profileData = profileDoc.data();
        if (profileData.invoicePrefix && profileData.invoicePrefix.trim()) {
          prefix = profileData.invoicePrefix.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        } else if (profileData.name) {
          prefix = getCompanyInitials(profileData.name);
        }
      }
    } catch (e) {
      console.error('Error fetching company profile for invoice prefix:', e);
    }
  }

  const cleanPrefix = prefix.replace(/-+$/, '').toUpperCase() || 'INV';
  const counterDocId = `invoices_${cleanPrefix.toLowerCase()}`;
  const counterRef = doc(db, 'counters', counterDocId);

  const newCount = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    if (!counterDoc.exists()) {
      // Query existing invoices with this prefix to avoid collision if invoices already exist
      let maxNum = 0;
      try {
        const existingInvoicesQuery = query(
          collection(db, 'invoices'),
          where('invoiceId', '>=', `${cleanPrefix}-`),
          where('invoiceId', '<=', `${cleanPrefix}-\uf8ff`)
        );
        const existingSnap = await getDocs(existingInvoicesQuery);
        existingSnap.docs.forEach(d => {
          const invId = d.data().invoiceId || '';
          const numStr = invId.replace(new RegExp(`^${cleanPrefix}-?`, 'i'), '');
          const num = parseInt(numStr, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        });
      } catch (err) {
        console.error('Error querying existing max invoice ID:', err);
      }

      const initialCount = maxNum > 0 ? maxNum + 1 : 1;
      transaction.set(counterRef, { count: initialCount });
      return initialCount;
    }

    const nextCount = (counterDoc.data().count || 0) + 1;
    transaction.update(counterRef, { count: nextCount });
    return nextCount;
  });

  return `${cleanPrefix}-${String(newCount).padStart(4, '0')}`;
}

export async function saveInvoice(
  data: z.infer<typeof CreateInvoiceSchema> & { id?: string; jobSheetId?: string | null },
  linkedJobSheetId?: string | null
) {
  const validatedData = CreateInvoiceSchema.safeParse(data);
  if (!validatedData.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }

  const targetJobSheetId = linkedJobSheetId || data.jobSheetId || null;

  const dataToSave: any = {
    ...validatedData.data,
    date: Timestamp.fromDate(validatedData.data.date as Date),
    dueDate: Timestamp.fromDate(validatedData.data.dueDate as Date),
    jobSheetId: targetJobSheetId,
  };

  try {
    if (data.id) {
      // Update existing
      const invoiceRef = doc(db, 'invoices', data.id);
      await updateDoc(invoiceRef, dataToSave);
    } else {
      // Create new
      const newInvoiceId = await getNextInvoiceId(validatedData.data.companyProfileId);
      dataToSave.invoiceId = newInvoiceId;
      dataToSave.createdAt = serverTimestamp();

      await addDoc(collection(db, 'invoices'), dataToSave);

      // Automatically update the Job Sheet with this invoice number if created from JID
      if (targetJobSheetId) {
        try {
          const jsRef = doc(db, 'jobSheets', targetJobSheetId);
          const jsSnap = await getDoc(jsRef);
          if (jsSnap.exists()) {
            const jsData = jsSnap.data();
            const historyEntry = {
              timestamp: Timestamp.now(),
              operator: 'System',
              action: 'Invoice Created',
              details: `Invoice ${newInvoiceId} created and linked to this Job Sheet.`,
            };
            await updateDoc(jsRef, {
              invoiceNumber: newInvoiceId,
              history: [...(jsData.history || []), historyEntry],
            });
          }
        } catch (jsErr) {
          console.error('Error updating Job Sheet with invoice number:', jsErr);
        }
      }
    }
    revalidatePath('/invoice-generator');
    revalidatePath('/job-sheet');
    revalidatePath('/js-report');
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
            const date = data.date;
            const dueDate = data.dueDate;
            const createdAt = data.createdAt;
            return {
                ...data,
                id: doc.id,
                date: date?.toDate ? date.toDate().toISOString() : date,
                dueDate: dueDate?.toDate ? dueDate.toDate().toISOString() : dueDate,
                createdAt: createdAt?.toDate ? createdAt.toDate().toISOString() : (createdAt ? String(createdAt) : null),
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

    
