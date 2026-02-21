
'use server';

import {
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  orderBy,
  query,
  Timestamp,
  writeBatch,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Contact } from '@/lib/types';
import { ContactSchema } from '@/lib/types';
import { db } from '@/lib/firebase';

const CreateContactSchema = ContactSchema.omit({
  id: true,
  createdAt: true,
});

export async function addContact(data: z.infer<typeof CreateContactSchema>) {
  const validatedData = CreateContactSchema.safeParse(data);
  if (!validatedData.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }

  try {
    await addDoc(collection(db, 'contacts'), {
      ...validatedData.data,
      createdAt: serverTimestamp(),
    });

    revalidatePath('/contact-list');
    return { success: true, message: 'Contact saved successfully.' };
  } catch (error) {
    console.error('Error adding contact:', error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred.',
    };
  }
}

export async function updateContact(id: string, data: z.infer<typeof CreateContactSchema>) {
  const validatedData = CreateContactSchema.safeParse(data);
  if (!validatedData.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }

  try {
    const contactRef = doc(db, 'contacts', id);
    await updateDoc(contactRef, validatedData.data);

    revalidatePath('/contact-list');
    revalidatePath('/job-sheet');
    revalidatePath('/quotation');
    return { success: true, message: 'Contact updated successfully.' };
  } catch (error) {
    console.error('Error updating contact:', error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred.',
    };
  }
}

export async function bulkAddContacts(contacts: z.infer<typeof CreateContactSchema>[]) {
  if (!contacts || contacts.length === 0) {
    return { success: false, message: 'No contacts provided.' };
  }

  try {
    // Firestore batches are limited to 500 operations
    const chunks = [];
    for (let i = 0; i < contacts.length; i += 500) {
      chunks.push(contacts.slice(i, i + 500));
    }

    let successCount = 0;
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((contactData) => {
        const validated = CreateContactSchema.safeParse(contactData);
        if (validated.success) {
          const contactRef = doc(collection(db, 'contacts'));
          batch.set(contactRef, {
            ...validated.data,
            createdAt: serverTimestamp(),
          });
          successCount++;
        }
      });
      await batch.commit();
    }

    revalidatePath('/contact-list');
    return { success: true, message: `Successfully imported ${successCount} contacts.` };
  } catch (error) {
    console.error('Error bulk adding contacts:', error);
    return { success: false, message: 'Failed to bulk import contacts.' };
  }
}

export async function getContacts(): Promise<Contact[]> {
  try {
    const q = query(collection(db, 'contacts'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAtTimestamp = data.createdAt as Timestamp;
      return {
        ...data,
        id: doc.id,
        createdAt: createdAtTimestamp ? createdAtTimestamp.toDate().toISOString() : new Date().toISOString(),
      } as Contact;
    });
  } catch (e) {
    console.error('Error fetching contacts:', e);
    return [];
  }
}
