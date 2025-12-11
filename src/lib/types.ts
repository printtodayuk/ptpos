

import { z } from 'zod';

export const operators = ['PTMGH', 'PTASAD', 'PTM', 'PTITAdmin', 'PTASH', 'PTRK'] as const;
export type Operator = (typeof operators)[number];

export const paymentMethods = ['Bank Transfer', 'Card Payment', 'Cash', 'ST Bank Transfer', 'AIR Bank Transfer'] as const;
export type PaymentMethod = typeof paymentMethods[number];

export const TransactionSchema = z.object({
  id: z.string().optional(),
  transactionId: z.string(),
  type: z.enum(['invoicing', 'non-invoicing']),
  invoiceNumber: z.string().optional().nullable(),
  date: z.union([z.date(), z.string()]),
  clientName: z.string().min(1, 'Client name is required'),
  jobDescription: z.string().optional().nullable(),
  jid: z.string().optional().nullable(), // Job ID
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

export type Transaction = Omit<z.infer<typeof TransactionSchema>, 'date'> & {
  date: Date | string;
};


export const jobSheetStatus = ['Hold', 'Studio', 'Production', 'Finishing', 'Cancel', 'Ready Pickup', 'Parcel Compare', 'Delivered', 'MGH', 'OS'] as const;
export type JobSheetStatus = (typeof jobSheetStatus)[number];
export const jobSheetTypes = ['Invoice', 'Quotation', 'N/A', 'STR', 'AIR'] as const;
export type JobSheetType = (typeof jobSheetTypes)[number];
export const paymentStatuses = ['Unpaid', 'Partially Paid', 'Paid'] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

const JobItemSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  price: z.coerce.number().min(0, 'Price cannot be negative.'),
  vatApplied: z.boolean().default(false),
});

export const JobSheetHistorySchema = z.object({
    timestamp: z.any(),
    operator: z.string(),
    action: z.string(),
    details: z.string(),
});
export type JobSheetHistory = z.infer<typeof JobSheetHistorySchema>;


export const JobSheetSchema = z.object({
  id: z.string().optional(),
  jobId: z.string(),
  invoiceNumber: z.string().optional(),
  tid: z.string().optional().nullable(),
  date: z.union([z.date(), z.string()]),
  operator: z.enum(operators),
  clientName: z.string().min(1, 'Client name is required.'),
  clientDetails: z.string().optional().nullable(),
  jobItems: z.array(JobItemSchema).min(1, 'At least one job item is required.'),
  subTotal: z.number(),
  vatAmount: z.number(),
  totalAmount: z.number(),
  paidAmount: z.number().default(0),
  dueAmount: z.number().default(0),
  status: z.enum(jobSheetStatus),
  paymentStatus: z.enum(paymentStatuses).default('Unpaid'),
  specialNote: z.string().optional().nullable(),
  irNumber: z.string().optional().nullable(),
  deliveryBy: z.date().optional().nullable(),
  type: z.enum(jobSheetTypes).default('Invoice'),
  createdAt: z.any().optional(),
  history: z.array(JobSheetHistorySchema).optional().default([]),
});

export type JobSheet = Omit<z.infer<typeof JobSheetSchema>, 'date' | 'deliveryBy' | 'history'> & {
    date: Date | string;
    deliveryBy?: Date | string | null;
    history?: JobSheetHistory[];
};

export const ContactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required.'),
  companyName: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  phone: z.string().min(1, 'Phone number is required.'),
  email: z.string().email('Invalid email address.'),
  createdAt: z.any().optional(),
});

export type Contact = z.infer<typeof ContactSchema>;

export const timeRecordStatus = ['clocked-in', 'on-break', 'clocked-out'] as const;
export type TimeRecordStatus = (typeof timeRecordStatus)[number];

const BreakRecordSchema = z.object({
  startTime: z.any(),
  endTime: z.any().nullable(),
});

export const TimeRecordSchema = z.object({
  id: z.string().optional(),
  operator: z.enum(operators),
  clockInTime: z.any(),
  clockOutTime: z.any().nullable(),
  status: z.enum(timeRecordStatus),
  breaks: z.array(BreakRecordSchema).default([]),
  totalWorkDuration: z.number().nullable().default(null),
  totalBreakDuration: z.number().nullable().default(null),
  date: z.string(), // YYYY-MM-DD
});

export type TimeRecord = Omit<z.infer<typeof TimeRecordSchema>, 'clockInTime' | 'clockOutTime' | 'breaks'> & {
  clockInTime: Date;
  clockOutTime?: Date | null;
  breaks: {
    startTime: Date;
    endTime?: Date | null;
  }[];
};

export const UpdateTimeRecordSchema = z.object({
    clockInTime: z.date(),
    clockOutTime: z.date().nullable(),
    status: z.enum(timeRecordStatus),
    breaks: z.array(z.object({
        startTime: z.date(),
        endTime: z.date().nullable(),
    })).default([]),
});

    