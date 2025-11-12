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
import { TransactionSchema, operators, paymentMethods, type Transaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { ReceiptDialog } from './receipt-dialog';

type TransactionFormProps = {
  type: 'invoicing' | 'non-invoicing';
  onTransactionAdded?: () => void;
  transactionToEdit?: Transaction | null;
};

type FormValues = Omit<Transaction, 'id' | 'createdAt' | 'transactionId'>;

const getFreshDefaultValues = (type: 'invoicing' | 'non-invoicing'): Partial<FormValues> => ({
    type: type,
    date: undefined,
    clientName: '',
    jobDescription: '',
    amount: 0,
    vatApplied: false,
    totalAmount: 0,
    paidAmount: 0,
    dueAmount: 0,
    paymentMethod: 'Bank Transfer',
    operator: 'PTMGH',
    invoiceNumber: '',
    reference: '',
    adminChecked: false,
    checkedBy: null,
});


export function TransactionForm({ type, onTransactionAdded, transactionToEdit }: TransactionFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [dueAmount, setDueAmount] = useState<number>(0);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(TransactionSchema.omit({ id: true, createdAt: true, transactionId: true })),
    defaultValues: getFreshDefaultValues(type),
  });
  
  useEffect(() => {
    // Set date only on client to avoid hydration mismatch
    const currentFormDate = form.getValues('date');
    if (!currentFormDate) {
      form.setValue('date', new Date());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (transactionToEdit) {
      setIsEditMode(true);
      form.reset({
        ...transactionToEdit,
        date: new Date(transactionToEdit.date),
      });
    } else {
      setIsEditMode(false);
      form.reset(getFreshDefaultValues(type));
      form.setValue('date', new Date());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionToEdit, type]);
  
  const watchedAmount = form.watch('amount');
  const watchedVatApplied = form.watch('vatApplied');
  const watchedPaidAmount = form.watch('paidAmount');

  useEffect(() => {
    const currentAmount = isNaN(watchedAmount) ? 0 : watchedAmount;
    const newTotal = watchedVatApplied ? currentAmount * 1.2 : currentAmount;
    setTotalAmount(newTotal);
    form.setValue('totalAmount', newTotal);

    const currentPaidAmount = isNaN(watchedPaidAmount) ? 0 : watchedPaidAmount;
    const newDue = newTotal - currentPaidAmount;
    setDueAmount(newDue);
    form.setValue('dueAmount', newDue);

  }, [watchedAmount, watchedVatApplied, watchedPaidAmount, form]);

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      const result = isEditMode && transactionToEdit?.id 
        ? await updateTransaction(transactionToEdit.id, data)
        : await addTransaction(data);

      if (result.success && result.transaction) {
        if (isEditMode) {
            toast({ title: "Success", description: "Transaction updated successfully." });
        } else {
            setLastTransaction(result.transaction);
        }
        form.reset(getFreshDefaultValues(type));
        form.setValue('date', new Date());
        setIsEditMode(false);
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
    setIsEditMode(false);
    form.reset(getFreshDefaultValues(type));
    form.setValue('date', new Date());
    onTransactionAdded?.(); // To signal a refresh if needed
  }

  return (
    <>
      <ReceiptDialog 
        transaction={lastTransaction}
        isOpen={!!lastTransaction && !isEditMode}
        onClose={() => setLastTransaction(null)}
      />
      <Card>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="capitalize">{isEditMode ? `Editing TID: ${transactionToEdit?.transactionId}` : `${type}`}</CardTitle>
            <CardDescription>{isEditMode ? 'Update the transaction details below.' : 'Enter the details for the new transaction.'}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
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
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, 'PPP', { locale: enGB }) : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
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
              <Input id="clientName" {...form.register('clientName')} />
              {form.formState.errors.clientName && <p className="text-sm text-destructive">{form.formState.errors.clientName.message}</p>}
            </div>
            
            {type === 'invoicing' && (
              <div className="space-y-2 col-span-1 md:col-span-1 lg:col-span-1">
                <Label htmlFor="invoiceNumber">Invoice Number (Optional)</Label>
                <Input id="invoiceNumber" {...form.register('invoiceNumber')} />
              </div>
            )}

            <div className={cn("space-y-2", type === 'invoicing' ? 'col-span-1 md:col-span-2 lg:col-span-3' : 'col-span-1 md:col-span-2 lg:col-span-4')}>
              <Label htmlFor="jobDescription">Job Description (Optional)</Label>
              <Textarea id="jobDescription" {...form.register('jobDescription')} />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 lg:col-span-4">
              <div className="space-y-2">
                  <Label htmlFor="amount">Amount (£)</Label>
                  <Input id="amount" type="number" step="0.01" {...form.register('amount', {valueAsNumber: true})} />
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
                          />
                      )}
                      />
              </div>

              <div className="space-y-2">
                  <Label>Total Amount</Label>
                  <Input value={`£${totalAmount.toFixed(2)}`} readOnly className="font-bold bg-muted" />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="paidAmount">Paid Amount (£)</Label>
                  <Input id="paidAmount" type="number" step="0.01" {...form.register('paidAmount', {valueAsNumber: true})} />
                  {form.formState.errors.paidAmount && <p className="text-sm text-destructive">{form.formState.errors.paidAmount.message}</p>}
              </div>
                <div className="space-y-2">
                    <Label>Due Amount</Label>
                    <Input value={`£${dueAmount.toFixed(2)}`} readOnly className="font-bold bg-muted" />
                </div>
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

            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <Label htmlFor="reference">Reference (Optional)</Label>
              <Input id="reference" {...form.register('reference')} />
            </div>

          </CardContent>
          <CardFooter className="justify-end gap-2">
            {isEditMode && <Button type="button" variant="outline" onClick={cancelEdit}>Cancel</Button>}
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? "Update Transaction" : "Add Transaction"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </>
  );
}
