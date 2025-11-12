'use server';

import { z } from 'zod';
import { TransactionSchema } from '@/lib/types';
import { addTransaction as addTransactionServer } from '@/lib/server-actions';

// This file is now safe to use in client components.
// It acts as a pass-through to the server-only actions.

const CreateTransactionSchema = TransactionSchema.omit({
  id: true,
  createdAt: true,
  userId: true, // Also omitting here
});

export async function addTransaction(
  data: z.infer<typeof CreateTransactionSchema>
) {
  // This is a client-safe pass-through function.
  // It calls the actual server action, keeping server-only code separate.
  return addTransactionServer(data);
}