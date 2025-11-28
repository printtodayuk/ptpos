'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { enGB } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { addTransaction, updateTransaction } from '@/lib/server-actions';
import { getJobSheetByJobId } from '@/lib/server-actions-jobs';
import { TransactionSchema, operators, paymentMethods, type Transaction, type Operator } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { ReceiptDialog } from './receipt-dialog';
import { useDebounce } from '@/hooks/use-debounce';

type TransactionFormProps = {
  type: 'invoicing' | 'non-invoicing';
  onTransactionAdded?: () => void;
  transactionToEdit?: Transaction | null;
};

type FormValues = Omit<Transaction, 'id' | 'createdAt' | 'transactionId'>;

const getFreshDefaultValues = (type: 'invoicing' | 'non-invoicing', operator: Operator | null): Partial<FormValues> => ({
    type: type,
    date: new Date(),
    clientName: '',
    jobDescription: '',
    jid: '',
    amount: 0,
    vatApplied: false,
    totalAmount: 0,
    paidAmount: 0,
    dueAmount: 0,
    paymentMethod: 'Bank Transfer',
    operator: operator || undefined,
    invoiceNumber: '',
    reference: '',
    adminChecked: false,
    checkedBy: null,
});


export function TransactionForm({ type, onTransactionAdded, transactionToEdit }: TransactionFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isFetchingJob, startFetchingJobTransition] = useTransition();
  const { toast } = useToast();
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [lastOperator, setLastOperator] = useState<Operator>('PTMGH');

  const isEditMode = !!transactionToEdit;

  const form = useForm<FormValues>({
    resolver: zodResolver(TransactionSchema.omit({ id: true, createdAt: true, transactionId: true })),
    defaultValues: getFreshDefaultValues(type, lastOperator),
  });

  const jidValue = form.watch('jid');
  const debouncedJid = useDebounce(jidValue, 500);

  useEffect(() => {
    if (debouncedJid) {
      startFetchingJobTransition(async () => {
        const jobSheet = await getJobSheetByJobId(`JID${debouncedJid}`);
        if (jobSheet) {
          form.setValue('clientName', jobSheet.clientName);
          form.setValue('amount', jobSheet.subTotal);
          form.setValue('vatApplied', jobSheet.vatAmount > 0);
          form.setValue('totalAmount', jobSheet.totalAmount);
          form.setValue('paidAmount', jobSheet.totalAmount); // Default paid to total
          form.setValue('jobDescription', jobSheet.jobItems.map(item => `${item.quantity}x ${item.description}`).join(', '));
        } else {
          // Clear fields if no job sheet is found
            form.setValue('clientName', '');
            form.setValue('amount', 0);
            form.setValue('vatApplied', false);
            form.setValue('jobDescription', '');
        }
      });
    }
  }, [debouncedJid, form]);

  useEffect(() => {
    if (transactionToEdit) {
      const valuesToReset = {
        ...transactionToEdit,
        date: new Date(transactionToEdit.date),
        jid: transactionToEdit.jid?.replace('JID', '') || '',
      };
      form.reset(valuesToReset);
    } else {
      form.reset(getFreshDefaultValues(type, lastOperator));
    }
  }, [transactionToEdit, type, form, lastOperator]);
  
  const watchedAmount = form.watch('amount');
  const watchedVatApplied = form.watch('vatApplied');
  const watchedPaidAmount = form.watch('paidAmount');
  const watchedOperator = form.watch('operator');

  useEffect(() => {
      const total = watchedVatApplied ? watchedAmount * 1.2 : watchedAmount;
      const paid = isNaN(watchedPaidAmount) ? 0 : watchedPaidAmount;
      const due = total - paid;
      if (form.getValues('totalAmount') !== total) {
        form.setValue('totalAmount', total);
      }
      if (form.getValues('dueAmount') !== due) {
        form.setValue('dueAmount', due);
      }
  }, [watchedAmount, watchedVatApplied, watchedPaidAmount, form]);
  
  useEffect(() => {
    if (watchedOperator) {
      setLastOperator(watchedOperator);
    }
  }, [watchedOperator]);


  const onSubmit = (data: FormValues) => {
    const dataWithPrefix = { ...data };
    if (data.jid) {
        dataWithPrefix.jid = `JID${data.jid}`;
    }

    startTransition(async () => {
      const result = isEditMode && transactionToEdit?.id 
        ? await updateTransaction(transactionToEdit.id, dataWithPrefix)
        : await addTransaction(dataWithPrefix);

      if (result.success && result.transaction) {
        if (isEditMode) {
            toast({ title: "Success", description: "Transaction updated successfully." });
        } else {
            setLastTransaction(result.transaction);
        }
        form.reset(getFreshDefaultValues(type, lastOperator));
        onTransactionAdded?.();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.message,
        });
      }
    });
  };

  const cancelEdit = () => {
    onTransactionAdded?.(); 
  }
  
  const formTitle = type === 'non-invoicing' ? 'PT Till' : 'Xero Transaction';
  const Wrapper = isEditMode ? 'div' : Card;
  const isLockedByJid = !!jidValue && !isEditMode;

  return (
    <>
      <ReceiptDialog 
        transaction={lastTransaction}
        isOpen={!!lastTransaction && !isEditMode}
        onClose={() => setLastTransaction(null)}
      />
      <Wrapper className={!isEditMode ? 'w-full' : ''}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {!isEditMode && (
            <CardHeader>
              <CardTitle className="capitalize">{formTitle}</CardTitle>
              <CardDescription>Enter a Job ID to auto-fill details or enter manually.</CardDescription>
            </CardHeader>
          )}
          <CardContent className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", isEditMode && "p-0 pt-4")}>
            
             <div className="space-y-2 lg:col-span-1 relative">
                <Label htmlFor="jid">Job ID (Optional)</Label>
                <div className="flex items-center">
                    <span className="inline-flex h-10 items-center px-3 rounded-l-md border border-r-0 border-input bg-gray-100 text-muted-foreground text-sm">
                        JID
                    </span>
                    <Input 
                        id="jid" 
                        type="number"
                        {...form.register('jid')} 
                        placeholder="0001" 
                        disabled={isEditMode}
                        className="rounded-l-none"
                     />
                </div>
                {isFetchingJob && <Loader2 className="absolute right-3 top-9 h-4 w-4 animate-spin" />}
            </div>

            <div className="space-y-2 lg:col-span-1">
              <Label htmlFor="date">Date</Label>
              <Controller
                control={form.control}
                name="date"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                         disabled={isLockedByJid || isEditMode}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, 'PPP', { locale: enGB }) : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value as Date}
                        onSelect={field.onChange}
                        locale={enGB}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {form.formState.errors.date && <p className="text-sm text-destructive">{form.formState.errors.date.message}</p>}
            </div>

            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input id="clientName" {...form.register('clientName')} readOnly={isLockedByJid} disabled={isLockedByJid} />
              {form.formState.errors.clientName && <p className="text-sm text-destructive">{form.formState.errors.clientName.message}</p>}
            </div>

            <div className="space-y-2 lg:col-span-4">
              <Label htmlFor="jobDescription">Job Description</Label>
              <Textarea id="jobDescription" {...form.register('jobDescription')} readOnly={isLockedByJid} disabled={isLockedByJid}/>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 lg:col-span-4">
              <div className="space-y-2">
                  <Label htmlFor="amount">Amount (£)</Label>
                  <Input id="amount" type="number" step="0.01" {...form.register('amount', {valueAsNumber: true})} readOnly={isLockedByJid} disabled={isLockedByJid} />
                  {form.formState.errors.amount && <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>}
              </div>

              <div className="space-y-2 flex flex-row items-center justify-between rounded-lg border p-3 px-4 sm:col-span-2 md:col-span-1">
                  <div className="space-y-0.5">
                      <Label htmlFor="vatApplied">Apply VAT (20%)</Label>
                  </div>
                  <Controller
                      control={form.control}
                      name="vatApplied"
                      render={({ field }) => (
                          <Switch
                              id="vatApplied"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isLockedByJid || isEditMode}
                          />
                      )}
                      />
              </div>

              <div className="space-y-2">
                  <Label>Total Amount</Label>
                  <Input value={`£${(form.watch('totalAmount') || 0).toFixed(2)}`} readOnly className="font-bold bg-muted" />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="paidAmount">Paid Amount (£)</Label>
                  <Input id="paidAmount" type="number" step="0.01" {...form.register('paidAmount', {valueAsNumber: true})} />
                  {form.formState.errors.paidAmount && <p className="text-sm text-destructive">{form.formState.errors.paidAmount.message}</p>}
              </div>
                <div className="space-y-2">
                    <Label>Due Amount</Label>
                    <Input value={`£${(form.watch('dueAmount') || 0).toFixed(2)}`} readOnly className="font-bold bg-muted" />
                </div>
            </div>

            <div className="space-y-2 lg:col-span-1">
              <Label htmlFor="operator">Operator Name</Label>
              <Controller
                control={form.control}
                name="operator"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="operator">
                      <SelectValue placeholder="Select operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op} value={op}>{op}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.operator && <p className="text-sm text-destructive">{form.formState.errors.operator.message}</p>}
            </div>

            <div className="space-y-2 lg:col-span-1">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Controller
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="paymentMethod">
                      <SelectValue placeholder="Select payment method" />
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

            <div className="space-y-2 md:col-span-2 lg:col-span-2">
              <Label htmlFor="reference">Reference (Optional)</Label>
              <Input id="reference" {...form.register('reference')} />
            </div>

          </CardContent>
          <CardFooter className={cn("justify-end gap-2", isEditMode ? 'pt-6' : 'pt-0')}>
            {isEditMode && <Button type="button" variant="outline" onClick={cancelEdit}>Cancel</Button>}
            <Button type="submit" disabled={isPending || isFetchingJob}>
              {(isPending || isFetchingJob) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? "Update Transaction" : "Add Transaction"}
            </Button>
          </CardFooter>
        </form>
      </Wrapper>
    </>
  );
}
