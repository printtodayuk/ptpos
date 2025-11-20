'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { enGB } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { addJobSheet, updateJobSheet } from '@/lib/server-actions-jobs';
import { JobSheetSchema, operators, jobSheetStatus, type JobSheet, type Operator } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { JobSheetViewDialog } from './job-sheet-view-dialog';

type JobSheetFormProps = {
  onJobSheetAdded?: () => void;
  jobSheetToEdit?: JobSheet | null;
};

type FormValues = Omit<JobSheet, 'id' | 'createdAt' | 'jobId'>;

let lastOperator: Operator = 'PTMGH';

const getFreshDefaultValues = (): Partial<FormValues> => ({
  date: new Date(),
  operator: lastOperator,
  clientName: '',
  clientDetails: '',
  jobItems: [{ description: '', quantity: 1, price: 0 }],
  subTotal: 0,
  vatApplied: false,
  vatAmount: 0,
  totalAmount: 0,
  status: 'Hold',
  specialNote: '',
  irNumber: '',
});

export function JobSheetForm({ onJobSheetAdded, jobSheetToEdit }: JobSheetFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [lastJobSheet, setLastJobSheet] = useState<JobSheet | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(JobSheetSchema.omit({ id: true, createdAt: true, jobId: true })),
    defaultValues: getFreshDefaultValues(),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'jobItems',
  });

  useEffect(() => {
    if (jobSheetToEdit) {
      setIsEditMode(true);
      form.reset({
        ...jobSheetToEdit,
        date: new Date(jobSheetToEdit.date),
      });
    } else {
      setIsEditMode(false);
      form.reset(getFreshDefaultValues());
    }
  }, [jobSheetToEdit, form.reset]);

  const watchedItems = form.watch('jobItems');
  const watchedVatApplied = form.watch('vatApplied');
  const watchedOperator = form.watch('operator');

  useEffect(() => {
    const subTotal = watchedItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    const vatAmount = watchedVatApplied ? subTotal * 0.2 : 0;
    const totalAmount = subTotal + vatAmount;

    form.setValue('subTotal', subTotal);
    form.setValue('vatAmount', vatAmount);
    form.setValue('totalAmount', totalAmount);
  }, [watchedItems, watchedVatApplied, form]);

  useEffect(() => {
    lastOperator = watchedOperator;
  }, [watchedOperator]);

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      const result = isEditMode && jobSheetToEdit?.id
        ? await updateJobSheet(jobSheetToEdit.id, data)
        : await addJobSheet(data);

      if (result.success && result.jobSheet) {
        if (isEditMode) {
          toast({ title: 'Success', description: 'Job sheet updated successfully.' });
        } else {
          setLastJobSheet(result.jobSheet);
          toast({ title: 'Success', description: `Job Sheet ${result.jobSheet.jobId} created.` });
        }
        form.reset(getFreshDefaultValues());
        setIsEditMode(false);
        onJobSheetAdded?.();
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
    onJobSheetAdded?.();
  };

  const formTitle = isEditMode ? `Edit Job Sheet ${jobSheetToEdit?.jobId}` : 'Create Job Sheet';
  const Wrapper = isEditMode ? 'div' : Card;

  return (
    <>
      <JobSheetViewDialog 
        jobSheet={lastJobSheet}
        isOpen={!!lastJobSheet && !isEditMode}
        onClose={() => setLastJobSheet(null)}
      />
      <Wrapper className={!isEditMode ? 'w-full' : ''}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {!isEditMode && (
            <CardHeader>
              <CardTitle>{formTitle}</CardTitle>
              <CardDescription>Fill in the details to create a new job sheet.</CardDescription>
            </CardHeader>
          )}
           <CardContent className={cn("grid grid-cols-1 md:grid-cols-4 gap-6", isEditMode && "p-0 pt-4")}>
            {/* Row 1: Operator, Date, Client Name */}
            <div className="space-y-2">
              <Label htmlFor="operator">Operator</Label>
              <Controller name="operator" control={form.control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{operators.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Controller name="date" control={form.control} render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, 'PPP', { locale: enGB }) : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                </Popover>
              )} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input id="clientName" {...form.register('clientName')} />
              {form.formState.errors.clientName && <p className="text-sm text-destructive">{form.formState.errors.clientName.message}</p>}
            </div>

            {/* Row 2: Client Details */}
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="clientDetails">Client Details (Address, Phone, etc.)</Label>
              <Textarea id="clientDetails" {...form.register('clientDetails')} />
            </div>

            {/* Row 3: Dynamic Job Items */}
            <div className="space-y-4 md:col-span-4">
              <Label>Job Items</Label>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-12 sm:col-span-7 space-y-1">
                     <Label htmlFor={`jobItems.${index}.description`} className="text-xs">Description</Label>
                     <Textarea id={`jobItems.${index}.description`} {...form.register(`jobItems.${index}.description`)} placeholder="Job description" />
                  </div>
                   <div className="col-span-4 sm:col-span-2 space-y-1">
                     <Label htmlFor={`jobItems.${index}.quantity`} className="text-xs">Quantity</Label>
                     <Input id={`jobItems.${index}.quantity`} type="number" {...form.register(`jobItems.${index}.quantity`, { valueAsNumber: true })} placeholder="Qty" />
                  </div>
                   <div className="col-span-4 sm:col-span-2 space-y-1">
                     <Label htmlFor={`jobItems.${index}.price`} className="text-xs">Price (£)</Label>
                     <Input id={`jobItems.${index}.price`} type="number" step="0.01" {...form.register(`jobItems.${index}.price`, { valueAsNumber: true })} placeholder="Price" />
                  </div>
                  <div className="col-span-4 sm:col-span-1 flex items-end h-full">
                    <Button type="button" variant="destructive" size="icon" onClick={() => fields.length > 1 && remove(index)} disabled={fields.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
               {form.formState.errors.jobItems && <p className="text-sm text-destructive">{form.formState.errors.jobItems.message || form.formState.errors.jobItems.root?.message}</p>}
              <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, price: 0 })}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </div>
            
            {/* Row 4: Totals */}
            <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4 items-center rounded-lg border p-4">
                <div className="space-y-2">
                    <Label>Sub-Total</Label>
                    <Input value={`£${form.getValues('subTotal').toFixed(2)}`} readOnly className="font-bold bg-muted" />
                </div>
                <div className="space-y-2 flex flex-row items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="vatApplied">Apply VAT (20%)</Label>
                    <Controller control={form.control} name="vatApplied" render={({ field }) => ( <Switch id="vatApplied" checked={field.value} onCheckedChange={field.onChange} /> )} />
                </div>
                 <div className="space-y-2">
                    <Label>VAT Amount</Label>
                    <Input value={`£${form.getValues('vatAmount').toFixed(2)}`} readOnly className="font-bold bg-muted" />
                </div>
                 <div className="space-y-2">
                    <Label>Total Amount</Label>
                    <Input value={`£${form.getValues('totalAmount').toFixed(2)}`} readOnly className="font-bold bg-primary text-primary-foreground" />
                </div>
            </div>

            {/* Row 5: Status, IR Number */}
             <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Controller name="status" control={form.control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{jobSheetStatus.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="irNumber">IR Number</Label>
              <Input id="irNumber" {...form.register('irNumber')} />
            </div>

            {/* Row 6: Special Note */}
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="specialNote">Special Note</Label>
              <Textarea id="specialNote" {...form.register('specialNote')} />
            </div>
          </CardContent>
          <CardFooter className={cn("justify-end gap-2", isEditMode && "pt-6")}>
            {isEditMode && <Button type="button" variant="outline" onClick={cancelEdit}>Cancel</Button>}
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? "Update Job Sheet" : "Create Job Sheet"}
            </Button>
          </CardFooter>
        </form>
      </Wrapper>
    </>
  );
}
