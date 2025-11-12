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
import { addTransaction } from '@/lib/server-actions';
import { TransactionSchema, operators, paymentMethods, type Transaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';

type TransactionFormProps = {
  type: 'invoicing' | 'non-invoicing';
};

type FormValues = Omit<Transaction, 'id' | 'createdAt' | 'userId'>;

export function TransactionForm({ type }: TransactionFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [totalAmount, setTotalAmount] = useState<number>(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(TransactionSchema.omit({ id: true, createdAt: true, userId: true })),
    defaultValues: {
      type: type,
      date: new Date(),
      clientName: '',
      jobDescription: '',
      amount: 0,
      vatApplied: false,
      totalAmount: 0,
      paymentMethod: 'Bank Transfer',
      operator: 'PTMGH',
      invoiceNumber: '',
      reference: '',
      adminChecked: false,
      checkedBy: null,
    },
  });
  
  const watchedAmount = form.watch('amount');
  const watchedVatApplied = form.watch('vatApplied');

  useEffect(() => {
    const currentAmount = isNaN(watchedAmount) ? 0 : watchedAmount;
    const newTotal = watchedVatApplied ? currentAmount * 1.2 : currentAmount;
    setTotalAmount(newTotal);
    form.setValue('totalAmount', newTotal);
  }, [watchedAmount, watchedVatApplied, form]);

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      const result = await addTransaction(data);
      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        form.reset({
            type: type,
            date: new Date(),
            clientName: '',
            jobDescription: '',
            amount: 0,
            vatApplied: false,
            totalAmount: 0,
            paymentMethod: 'Bank Transfer',
            operator: 'PTMGH',
            invoiceNumber: '',
            reference: '',
            adminChecked: false,
            checkedBy: null,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.message,
        });
      }
    });
  };

  return (
    <Card>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardHeader>
          <CardTitle className="capitalize">{type}</CardTitle>
          <CardDescription>Enter the details for the new transaction.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="space-y-2 lg:col-span-1">
            <Label htmlFor="operator">Operator Name</Label>
            <Controller
              control={form.control}
              name="operator"
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="invoiceNumber">Invoice Number (Optional)</Label>
              <Input id="invoiceNumber" {...form.register('invoiceNumber')} />
            </div>
          )}

          <div className={cn("lg:col-span-2", type === 'invoicing' ? "lg:col-start-3" : "")}>
            <div className="spacey-y-2">
              <Label htmlFor="jobDescription">Job Description (Optional)</Label>
              <Textarea id="jobDescription" {...form.register('jobDescription')} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 lg:col-span-4">
            <div className="space-y-2">
                <Label htmlFor="amount">Amount (£)</Label>
                <Input id="amount" type="number" step="0.01" {...form.register('amount', {valueAsNumber: true})} />
                {form.formState.errors.amount && <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>}
            </div>

            <div className="space-y-2 flex flex-row items-center justify-between rounded-lg border p-3 px-4">
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
                <Input value={`£${totalAmount.toFixed(2)}`} readOnly className="font-bold text-lg h-auto bg-muted" />
            </div>
          </div>


          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <Controller
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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

          <div className="space-y-2 lg:col-span-3">
            <Label htmlFor="reference">Reference (Optional)</Label>
            <Input id="reference" {...form.register('reference')} />
          </div>

        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending} className="ml-auto">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Transaction
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
