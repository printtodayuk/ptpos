
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, PlusCircle, Trash2, Lock } from 'lucide-react';
import { enGB } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { addJobSheet, updateJobSheet } from '@/lib/server-actions-jobs';
import { JobSheetSchema, operators, jobSheetStatus, type JobSheet, type Operator, jobSheetTypes, jobSheetStatus as jobSheetStatuses } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { JobSheetViewDialog } from './job-sheet-view-dialog';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useSession } from '../auth/session-provider';

type JobSheetFormProps = {
  onJobSheetAdded?: () => void;
  jobSheetToEdit?: JobSheet | null;
};

type FormValues = Omit<JobSheet, 'id' | 'createdAt' | 'jobId'>;


const getFreshDefaultValues = (operator: Operator | null): Partial<FormValues> => ({
  date: new Date(),
  operator: operator || undefined,
  clientName: '',
  clientDetails: '',
  jobItems: [{ description: '', quantity: 1, price: 0, vatApplied: false }],
  subTotal: 0,
  vatAmount: 0,
  totalAmount: 0,
  status: 'Hold',
  specialNote: '',
  irNumber: '',
  deliveryBy: undefined,
  type: 'Invoice',
  tid: '',
});

export function JobSheetForm({ onJobSheetAdded, jobSheetToEdit }: JobSheetFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { operator: loggedInOperator } = useSession();
  const [lastJobSheet, setLastJobSheet] = useState<JobSheet | null>(null);
  const [lastOperator, setLastOperator] = useState<Operator>(loggedInOperator || 'PTMGH');
  const [currentJobSheetId, setCurrentJobSheetId] = useState<string | undefined>(undefined);

  const isEditMode = !!jobSheetToEdit;
  const isPaid = isEditMode && (jobSheetToEdit.paymentStatus === 'Paid' || jobSheetToEdit.paymentStatus === 'Partially Paid');

  const form = useForm<FormValues>({
    resolver: zodResolver(JobSheetSchema.omit({ id: true, createdAt: true, jobId: true })),
    defaultValues: getFreshDefaultValues(loggedInOperator),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'jobItems',
  });

  useEffect(() => {
    if (jobSheetToEdit && jobSheetToEdit.id !== currentJobSheetId) {
        const deliveryByDate = jobSheetToEdit.deliveryBy ? new Date(jobSheetToEdit.deliveryBy) : undefined;
        form.reset({
            ...jobSheetToEdit,
            date: new Date(jobSheetToEdit.date),
            deliveryBy: deliveryByDate,
            irNumber: jobSheetToEdit.irNumber || '',
            specialNote: jobSheetToEdit.specialNote || '',
            clientDetails: jobSheetToEdit.clientDetails || '',
            tid: jobSheetToEdit.tid || '',
        });
        setCurrentJobSheetId(jobSheetToEdit.id);
    } else if (!jobSheetToEdit && currentJobSheetId) {
        form.reset(getFreshDefaultValues(loggedInOperator));
        setCurrentJobSheetId(undefined);
    }
  }, [jobSheetToEdit, form, loggedInOperator, currentJobSheetId]);


  const watchedJobItems = form.watch('jobItems');
  
  const subTotal = (watchedJobItems || []).reduce((acc, item) => {
    const price = Number(item?.price) || 0;
    return acc + price;
  }, 0);

  const vatAmount = (watchedJobItems || []).reduce((acc, item) => {
    if (item?.vatApplied) {
      const price = Number(item?.price) || 0;
      return acc + (price * 0.2);
    }
    return acc;
  }, 0);

  const totalAmount = subTotal + vatAmount;

  useEffect(() => {
    const currentSubTotal = form.getValues('subTotal') || 0;
    const currentVatAmount = form.getValues('vatAmount') || 0;
    const currentTotalAmount = form.getValues('totalAmount') || 0;

    const tolerance = 0.001;

    if (Math.abs(currentSubTotal - subTotal) > tolerance) {
      form.setValue('subTotal', subTotal, { shouldValidate: true });
    }
    if (Math.abs(currentVatAmount - vatAmount) > tolerance) {
      form.setValue('vatAmount', vatAmount, { shouldValidate: true });
    }
    if (Math.abs(currentTotalAmount - totalAmount) > tolerance) {
      form.setValue('totalAmount', totalAmount, { shouldValidate: true });
    }
  }, [subTotal, vatAmount, totalAmount, form]);


  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      const operator = form.getValues('operator');
      if (operator) {
        setLastOperator(operator as Operator);
      }
      
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
        if (!isEditMode) {
            form.reset(getFreshDefaultValues(loggedInOperator));
        }
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
    onJobSheetAdded?.(); 
  };
  
  return (
    <>
      <JobSheetViewDialog 
        jobSheet={lastJobSheet}
        isOpen={!!lastJobSheet && !isEditMode}
        onClose={() => setLastJobSheet(null)}
      />
        <Card className="w-full">
            <form onSubmit={form.handleSubmit(onSubmit)}>
            {!isEditMode && (
                <CardHeader>
                <CardTitle>Create Job Sheet</CardTitle>
                <CardDescription>Fill in the details to create a new job sheet.</CardDescription>
                </CardHeader>
            )}
            <CardContent className={cn(isEditMode && "pt-6")}>
                {isPaid && (
                  <Alert variant="destructive" className="mb-6">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Editing Locked</AlertTitle>
                    <AlertDescription>
                      This job sheet has payments recorded against it. Financial details (items, prices, client) cannot be edited. You can still update the status or notes.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Row 1: Operator, Date, Client Name */}
                <div className="space-y-2">
                    <Label htmlFor="operator">Operator</Label>
                    <Controller name="operator" control={form.control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} disabled={!isEditMode}>
                        <SelectTrigger><SelectValue placeholder="Select Operator" /></SelectTrigger>
                        <SelectContent>{operators.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent>
                    </Select>
                    )} />
                    {form.formState.errors.operator && <p className="text-sm text-destructive">{form.formState.errors.operator.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Controller name="date" control={form.control} render={({ field }) => (
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')} disabled={isPaid}>
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
                    <Input id="clientName" {...form.register('clientName')} disabled={isPaid}/>
                    {form.formState.errors.clientName && <p className="text-sm text-destructive">{form.formState.errors.clientName.message}</p>}
                </div>

                {/* Row 2: Client Details */}
                <div className="space-y-2 md:col-span-4">
                    <Label htmlFor="clientDetails">Client Details (Address, Phone, etc.)</Label>
                    <Textarea id="clientDetails" {...form.register('clientDetails')} disabled={isPaid}/>
                </div>

                {/* Row 3: Dynamic Job Items */}
                <div className="space-y-4 md:col-span-4">
                    <Label>Job Items</Label>
                    <div className="grid grid-cols-12 gap-2 items-center border-b pb-2">
                        <div className="col-span-6 sm:col-span-6"><Label className="text-xs">Description</Label></div>
                        <div className="col-span-2 sm:col-span-2"><Label className="text-xs">Quantity</Label></div>
                        <div className="col-span-2 sm:col-span-2"><Label className="text-xs">Price (£)</Label></div>
                        <div className="col-span-1 sm:col-span-1 text-center"><Label className="text-xs">VAT</Label></div>
                        <div className="col-span-1 sm:col-span-1"></div>
                    </div>
                    {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                        <div className="col-span-12 sm:col-span-6">
                        <Textarea {...form.register(`jobItems.${index}.description`)} placeholder="Job description" className="h-10" disabled={isPaid}/>
                        </div>
                        <div className="col-span-3 sm:col-span-2">
                        <Input type="number" {...form.register(`jobItems.${index}.quantity`, { valueAsNumber: true })} placeholder="Qty" disabled={isPaid}/>
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                        <Input type="number" step="0.01" {...form.register(`jobItems.${index}.price`, { valueAsNumber: true })} placeholder="Price" disabled={isPaid}/>
                        </div>
                        <div className="col-span-1 sm:col-span-1 flex items-center justify-center h-full">
                        <Controller
                            control={form.control}
                            name={`jobItems.${index}.vatApplied`}
                            render={({ field: { value, onChange } }) => (
                                <Checkbox
                                    checked={value}
                                    onCheckedChange={onChange}
                                    disabled={isPaid}
                                />
                            )}
                        />
                        </div>
                        <div className="col-span-4 sm:col-span-1 flex items-start h-full">
                        <Button type="button" variant="destructive" size="icon" onClick={() => fields.length > 1 && remove(index)} disabled={fields.length <= 1 || isPaid}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        </div>
                    </div>
                    ))}
                    {form.formState.errors.jobItems && <p className="text-sm text-destructive">{form.formState.errors.jobItems.message || form.formState.errors.jobItems.root?.message}</p>}
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, price: 0, vatApplied: false })} disabled={isPaid}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                    </Button>
                </div>
                
                {/* Row 4: Totals */}
                <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center rounded-lg border p-4">
                    <div className="space-y-2">
                        <Label>Sub-Total</Label>
                        <Input value={`£${subTotal.toFixed(2)}`} readOnly className="font-bold bg-muted" />
                    </div>
                    <div className="space-y-2">
                        <Label>VAT Amount</Label>
                        <Input value={`£${vatAmount.toFixed(2)}`} readOnly className="font-bold bg-muted" />
                    </div>
                    <div className="space-y-2">
                        <Label>Total Amount</Label>
                        <Input value={`£${totalAmount.toFixed(2)}`} readOnly className="font-bold bg-primary text-primary-foreground" />
                    </div>
                </div>
                 {/* Automation IDs */}
                 <div className="space-y-2 md:col-span-4">
                    <Label htmlFor="tid">Transaction ID (Optional)</Label>
                    <Input id="tid" {...form.register('tid')} placeholder="e.g. TID0001" disabled={isPaid}/>
                    <p className="text-xs text-muted-foreground">Link an existing transaction to this job sheet.</p>
                </div>


                {/* Row 5: Status, IR Number, etc */}
                <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Controller name="status" control={form.control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{jobSheetStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    )} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="irNumber">IR Number</Label>
                    <Input id="irNumber" {...form.register('irNumber')} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="deliveryBy">Delivery By</Label>
                    <Controller name="deliveryBy" control={form.control} render={({ field }) => (
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'PPP', { locale: enGB }) : <span>Pick a date</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent>
                    </Popover>
                    )} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Controller name="type" control={form.control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{jobSheetTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                    )} />
                </div>

                {/* Row 6: Special Note */}
                <div className="space-y-2 md:col-span-4">
                    <Label htmlFor="specialNote">Special Note</Label>
                    <Textarea id="specialNote" {...form.register('specialNote')} />
                </div>
                </div>
            </CardContent>
            <CardFooter className={cn("justify-end gap-2", isEditMode ? 'pt-6' : '')}>
                {isEditMode && <Button type="button" variant="outline" onClick={cancelEdit}>Cancel</Button>}
                <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? "Update Job Sheet" : "Create Job Sheet"}
                </Button>
            </CardFooter>
            </form>
        </Card>
    </>
  );
}

    

    