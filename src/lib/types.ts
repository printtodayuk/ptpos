import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

export const operators = ['PTMGH', 'PTASAD', 'PTM', 'PTITAdmin'] as const;
export type Operator = typeof operators[number];

export const paymentMethods = ['Bank Transfer', 'Card Payment', 'Cash'] as const;
export type PaymentMethod = typeof paymentMethods[number];

export const TransactionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['invoicing', 'non-invoicing']),
  invoiceNumber: z.string().optional(),
  date: z.date(),
  clientName: z.string().min(1, 'Client name is required'),
  jobDescription: z.string().optional(),
  amount: z.coerce.number().positive('Amount must be positive'),
  vatApplied: z.boolean(),
  totalAmount: z.number(),
  paymentMethod: z.enum(paymentMethods),
  reference: z.string().optional(),
  operator: z.enum(operators),
  adminChecked: z.boolean().default(false),
  checkedBy: z.string().nullable().default(null),
  createdAt: z.instanceof(Timestamp).optional(),
});

export type Transaction = z.infer<typeof TransactionSchema>;
