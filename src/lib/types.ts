import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

export const operators = ['PTMGH', 'PTASAD', 'PTM', 'PTITAdmin'] as const;
export type Operator = (typeof operators)[number];

export const paymentMethods = ['Bank Transfer', 'Card Payment', 'Cash'] as const;
export type PaymentMethod = typeof paymentMethods[number];

export const TransactionSchema = z.object({
  id: z.string().optional(),
  transactionId: z.string(),
  type: z.enum(['invoicing', 'non-invoicing']),
  invoiceNumber: z.string().optional().nullable(),
  date: z.date({ required_error: 'Please select a date.' }),
  clientName: z.string().min(1, 'Client name is required'),
  jobDescription: z.string().optional().nullable(),
  amount: z.coerce.number().positive('Amount must be positive'),
  vatApplied: z.boolean(),
  totalAmount: z.number(),
  paidAmount: z.coerce.number().min(0, 'Paid amount cannot be negative'),
  dueAmount: z.number(),
  paymentMethod: z.enum(paymentMethods),
  reference: z.string().optional().nullable(),
  operator: z.enum(operators),
  adminChecked: z.boolean().default(false),
  checkedBy: z.string().nullable().default(null),
  createdAt: z.any().optional(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

export const jobSheetStatus = ['Hold', 'Invoice', 'Cancel'] as const;
export type JobSheetStatus = (typeof jobSheetStatus)[number];

const JobItemSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  price: z.coerce.number().min(0, 'Price cannot be negative.'),
});

export const JobSheetSchema = z.object({
  id: z.string().optional(),
  jobId: z.string(),
  date: z.date({ required_error: 'Please select a date.' }),
  operator: z.enum(operators),
  clientName: z.string().min(1, 'Client name is required.'),
  clientDetails: z.string().optional().nullable(),
  jobItems: z.array(JobItemSchema).min(1, 'At least one job item is required.'),
  subTotal: z.number(),
  vatApplied: z.boolean(),
  vatAmount: z.number(),
  totalAmount: z.number(),
  status: z.enum(jobSheetStatus),
  specialNote: z.string().optional().nullable(),
  irNumber: z.string().optional().nullable(),
  createdAt: z.any().optional(),
});

export type JobSheet = z.infer<typeof JobSheetSchema>;
