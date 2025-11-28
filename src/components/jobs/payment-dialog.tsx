
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { type JobSheet, type Transaction, operators, paymentMethods } from '@/lib/types';
import { addTransactionFromJobSheet } from '@/lib/server-actions-jobs';


const PaymentFormSchema = z.object({
    jid: z.string(),
    clientName: z.string(),
    jobDescription: z.string().optional().nullable(),
    totalAmount: z.number(),
    paidAmount: z.coerce.number().min(0, 'Paid amount cannot be negative'),
    dueAmount: z.number(),
    paymentMethod: z.enum(paymentMethods),
    operator: z.enum(operators),
    reference: z.string().optional().nullable(),
    date: z.date(),
});


type PaymentFormValues = z.infer<typeof PaymentFormSchema>;

type PaymentDialogProps = {
  jobSheet: JobSheet | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (transaction: Transaction) => void;
};

export function PaymentDialog({ jobSheet, isOpen, onClose, onPaymentSuccess }: PaymentDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(PaymentFormSchema),
    defaultValues: {
      paidAmount: 0,
      dueAmount: 0,
      paymentMethod: 'Cash',
      operator: 'PTMGH',
      reference: '',
      date: new Date(),
    },
  });

  const watchedPaidAmount = form.watch('paidAmount');

  useEffect(() => {
    if (jobSheet) {
      const jobDescription = jobSheet.jobItems.map(item => `${item.quantity}x ${item.description}`).join(', ');
      form.reset({
        jid: jobSheet.jobId,
        clientName: jobSheet.clientName,
        totalAmount: jobSheet.totalAmount,
        paidAmount: jobSheet.totalAmount, // Default to paying the full amount
        dueAmount: 0,
        paymentMethod: 'Cash',
        operator: 'PTMGH',
        jobDescription: jobDescription,
        reference: '',
        date: new Date(),
      });
    }
  }, [jobSheet, form, isOpen]); // Rerun when dialog opens

  useEffect(() => {
      const total = form.getValues('totalAmount');
      const paid = isNaN(watchedPaidAmount) ? 0 : watchedPaidAmount;
      const newDue = total - paid;
      if (form.getValues('dueAmount') !== newDue) {
        form.setValue('dueAmount', newDue);
      }
  }, [watchedPaidAmount, form]);


  const onSubmit = (data: PaymentFormValues) => {
    if (!jobSheet) return;

    startTransition(async () => {
      const result = await addTransactionFromJobSheet(jobSheet, data);
      
      if (result.success && result.transaction) {
        onPaymentSuccess(result.transaction);
        toast({ title: 'Success', description: 'Transaction created successfully.' });
        onClose();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.message || 'Failed to process payment.',
        });
      }
    });
  };

  if (!jobSheet) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment for Job <span className="font-mono">{jobSheet.jobId}</span></DialogTitle>
          <DialogDescription>
            Record a payment against this job sheet. This will create a new transaction in PT Till.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client Name</Label>
              <Input value={jobSheet.clientName} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label>Total Amount</Label>
              <Input value={`£${jobSheet.totalAmount.toFixed(2)}`} readOnly disabled className="font-bold" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
             <div className="space-y-2">
                <Label htmlFor="paidAmount">Paying Amount (£)</Label>
                <Input id="paidAmount" type="number" step="0.01" {...form.register('paidAmount', { valueAsNumber: true })} />
                {form.formState.errors.paidAmount && <p className="text-sm text-destructive">{form.formState.errors.paidAmount.message}</p>}
            </div>
            <div className="space-y-2">
                <Label>Due Amount</Label>
                <Input value={`£${form.watch('dueAmount').toFixed(2)}`} readOnly disabled className="font-bold"/>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Controller
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="paymentMethod">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method} value={method}>{method}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operator">Operator</Label>
              <Controller
                control={form.control}
                name="operator"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="operator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op} value={op}>{op}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
              <Label htmlFor="reference">Reference (Optional)</Label>
              <Input id="reference" {...form.register('reference')} />
            </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Create Transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
