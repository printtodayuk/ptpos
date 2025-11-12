'use server';

import { z } from 'zod';
import { TransactionSchema } from '@/lib/types';
import { addTransaction as addTransactionServer } from '@/lib/server-actions';

const CreateTransactionSchema = TransactionSchema.omit({
  id: true,
  createdAt: true,
});

export async function addTransaction(
  data: z.infer<typeof CreateTransactionSchema>
) {
  // This is a client-safe pass-through function.
  // It calls the actual server action, keeping server-only code separate.
  return addTransactionServer(data);
}
