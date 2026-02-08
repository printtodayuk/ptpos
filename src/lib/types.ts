
import { z } from 'zod';

export const operators = ['PTMGH', 'PTASAD', 'PTM', 'PTITAdmin', 'PTASH', 'PTRK'] as const;
export type Operator = (typeof operators)[number];

export const paymentMethods = ['Bank Transfer', 'Card Payment', 'Cash', 'ST Bank Transfer', 'AIR Bank Transfer'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const TransactionSchema = z.object({
  id: z.string().optional(),
  transactionId: z.string(),
  type: z.enum(['invoicing', 'non-invoicing']),
  invoiceNumber: z.string().optional().nullable(),
  date: z.union([z.date(), z.string()]),
  clientName: z.string().min(1, 'Client name is required'),
  jobDescription: z.string().optional().nullable(),
  jid: z.string().optional().nullable(), // Job ID or Quotation ID
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
export const quotationStatus = ['Sent', 'Hold', 'WFR', 'Approved', 'Declined'] as const;
export type QuotationStatus = (typeof quotationStatus)[number];
export const jobSheetTypes = ['Invoice', 'Quotation', 'N/A', 'STR', 'AIR'] as const;
export type JobSheetType = (typeof jobSheetTypes)[number];
export const paymentStatuses = ['Unpaid', 'Partially Paid', 'Paid'] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

const JobItemSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  price: z.coerce.number().min(0, 'Price cannot be negative.'),
  vatApplied: z.boolean({
    required_error: "VAT selection is required for each item.",
  }),
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
  jobId: z.string().optional(),
  invoiceNumber: z.string().optional().nullable(),
  tid: z.string().optional().nullable(),
  date: z.union([z.date(), z.string()]),
  operator: z.enum(operators),
  clientName: z.string().min(1, 'Client name is required.'),
  clientDetails: z.string().optional().nullable(),
  jobItems: z.array(JobItemSchema).min(1, 'At least one job item is required.'),
  subTotal: z.number(),
  discountType: z.enum(['percentage', 'amount']).default('amount'),
  discountValue: z.coerce.number().min(0).default(0),
  discountAmount: z.number().default(0),
  subTotalAfterDiscount: z.number().default(0),
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

export const QuotationHistorySchema = z.object({
    timestamp: z.any(),
    operator: z.string(),
    action: z.string(),
    details: z.string(),
});
export type QuotationHistory = z.infer<typeof QuotationHistorySchema>;

export const QuotationSchema = z.object({
  id: z.string().optional(),
  quotationId: z.string().optional(),
  invoiceNumber: z.string().optional().nullable(),
  tid: z.string().optional().nullable(),
  date: z.union([z.date(), z.string()]),
  operator: z.enum(operators),
  clientName: z.string().min(1, 'Client name is required.'),
  clientDetails: z.string().optional().nullable(),
  jobItems: z.array(JobItemSchema).min(1, 'At least one item is required.'),
  subTotal: z.number(),
  vatAmount: z.number(),
  totalAmount: z.number(),
  paidAmount: z.number().default(0).optional(),
  dueAmount: z.number().default(0),
  status: z.enum(quotationStatus),
  paymentStatus: z.enum(paymentStatuses).default('Unpaid').optional(),
  specialNote: z.string().optional().nullable(),
  jid: z.string().optional().nullable(),
  deliveryBy: z.date().optional().nullable(),
  type: z.enum(jobSheetTypes).default('Quotation'),
  createdAt: z.any().optional(),
  history: z.array(QuotationHistorySchema).optional().default([]),
});

export type Quotation = Omit<z.infer<typeof QuotationSchema>, 'date' | 'deliveryBy' | 'history' | 'status'> & {
    date: Date | string;
    deliveryBy?: Date | string | null;
    history?: QuotationHistory[];
    status: QuotationStatus;
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

export const CompanyProfileSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Company name is required.'),
  logoUrl: z.string().url('Must be a valid URL.').optional().or(z.literal('')),
  address: z.string().min(1, 'Address is required.'),
  email: z.string().email('Invalid email address.').optional().or(z.literal('')),
  website: z.string().url('Must be a valid URL.').optional().or(z.literal('')),
  bankDetails: z.string().optional(),
  createdAt: z.any().optional(),
});
export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;


export const invoiceStatus = ['Draft', 'Sent', 'Paid'] as const;
export type InvoiceStatus = (typeof invoiceStatus)[number];

export const InvoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  price: z.coerce.number().min(0, 'Price cannot be negative.'),
  vatApplied: z.boolean().default(false),
});

export const InvoiceSchema = z.object({
  id: z.string().optional(),
  invoiceId: z.string(),
  companyProfileId: z.string().min(1, "Please select a company profile."),
  clientName: z.string().min(1, 'Client name is required.'),
  clientAddress: z.string().min(1, 'Client address is required.'),
  date: z.union([z.date(), z.string()]),
  dueDate: z.union([z.date(), z.string()]),
  items: z.array(InvoiceItemSchema).min(1, 'At least one item is required.'),
  subTotal: z.number(),
  discountType: z.enum(['percentage', 'amount']).default('amount'),
  discountValue: z.coerce.number().min(0).default(0),
  discountAmount: z.number().default(0),
  subTotalAfterDiscount: z.number(),
  vatAmount: z.number(),
  totalAmount: z.number(),
  status: z.enum(invoiceStatus).default('Draft'),
  notes: z.string().optional(),
  createdAt: z.any().optional(),
});

export type Invoice = Omit<z.infer<typeof InvoiceSchema>, 'date' | 'dueDate'> & {
    date: Date | string;
    dueDate: Date | string;
};
