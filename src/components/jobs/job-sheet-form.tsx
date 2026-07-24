'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, PlusCircle, Trash2, Lock, UserPlus, Sparkles, User, Package, FileText, SlidersHorizontal } from 'lucide-react';
import { enGB } from 'date-fns/locale';
import Link from 'next/link';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
import { JobSheetSchema, jobSheetStatus, type JobSheet, type Operator, jobSheetTypes, jobSheetStatus as jobSheetStatuses, type Quotation, type Contact } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { JobSheetViewDialog } from './job-sheet-view-dialog';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useSession } from '../auth/session-provider';
import { Separator } from '../ui/separator';

type JobSheetFormProps = {
  onJobSheetAdded?: (jobSheet?: JobSheet) => void;
  jobSheetToEdit?: JobSheet | null;
  jobSheetToCreateFromQuotation?: Quotation | null;
};

type FormValues = Omit<JobSheet, 'id' | 'createdAt' | 'jobId'>;


const getFreshDefaultValues = (operator: Operator | null): Partial<FormValues> => ({
  date: new Date(),
  operator: operator || undefined,
  clientName: '',
  companyName: '',
  clientDetails: '',
  jobItems: [{ description: '', quantity: 1, price: 0, vatApplied: false }],
  subTotal: 0,
  discountType: 'amount',
  discountValue: 0,
  discountAmount: 0,
  subTotalAfterDiscount: 0,
  vatAmount: 0,
  totalAmount: 0,
  status: 'Hold',
  specialNote: '',
  irNumber: '',
  deliveryBy: undefined,
  type: 'Invoice',
  tid: '',
});

export function JobSheetForm({ onJobSheetAdded, jobSheetToEdit, jobSheetToCreateFromQuotation }: JobSheetFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { operator: loggedInOperator, operators: dynamicOperators } = useSession();
  const [lastJobSheet, setLastJobSheet] = useState<JobSheet | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  const isEditMode = !!jobSheetToEdit;
  const isConversionMode = !!jobSheetToCreateFromQuotation;
  const isPaid = isEditMode && (jobSheetToEdit.paymentStatus === 'Paid' || jobSheetToEdit.paymentStatus === 'Partially Paid');

  const form = useForm<FormValues>({
    resolver: zodResolver(JobSheetSchema.omit({ id: true, createdAt: true, jobId: true })) as any,
    defaultValues: getFreshDefaultValues(loggedInOperator),
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'jobItems',
  });

  // Real-time contacts listener to ensure latest data is always available
  useEffect(() => {
    const q = query(collection(db, 'contacts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          ...d,
          id: doc.id,
          createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as Contact;
      });
      setContacts(data);
    });
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    let newDefaultValues: Partial<FormValues> | null = null;
    let shouldReset = false;

    if (jobSheetToCreateFromQuotation) {
        shouldReset = true;
        newDefaultValues = {
            date: new Date(),
            operator: loggedInOperator || undefined,
            clientName: jobSheetToCreateFromQuotation.clientName,
            companyName: jobSheetToCreateFromQuotation.companyName || '',
            clientDetails: jobSheetToCreateFromQuotation.clientDetails || '',
            jobItems: jobSheetToCreateFromQuotation.jobItems,
            subTotal: jobSheetToCreateFromQuotation.subTotal,
            vatAmount: jobSheetToCreateFromQuotation.vatAmount,
            totalAmount: jobSheetToCreateFromQuotation.totalAmount,
            status: 'Hold',
            specialNote: `Converted from Quotation ${jobSheetToCreateFromQuotation.quotationId}.\n\n${jobSheetToCreateFromQuotation.specialNote || ''}`,
            irNumber: '',
            deliveryBy: jobSheetToCreateFromQuotation.deliveryBy ? new Date(jobSheetToCreateFromQuotation.deliveryBy) : undefined,
            type: 'Invoice',
            tid: jobSheetToCreateFromQuotation.tid,
            discountType: 'amount',
            discountValue: 0,
            discountAmount: 0,
            subTotalAfterDiscount: jobSheetToCreateFromQuotation.subTotal,
        };
    } else if (jobSheetToEdit) {
        shouldReset = true;
        newDefaultValues = {
            ...jobSheetToEdit,
            date: new Date(jobSheetToEdit.date),
            deliveryBy: jobSheetToEdit.deliveryBy ? new Date(jobSheetToEdit.deliveryBy) : undefined,
            irNumber: jobSheetToEdit.irNumber || '',
            specialNote: jobSheetToEdit.specialNote || '',
            clientDetails: jobSheetToEdit.clientDetails || '',
            tid: jobSheetToEdit.tid || '',
            discountType: jobSheetToEdit.discountType || 'amount',
            discountValue: jobSheetToEdit.discountValue || 0,
            companyName: jobSheetToEdit.companyName || '',
        };
    } else {
      shouldReset = true;
      newDefaultValues = getFreshDefaultValues(loggedInOperator);
    }
    
    if (shouldReset && newDefaultValues) {
        form.reset(newDefaultValues);
    }
  }, [jobSheetToEdit, jobSheetToCreateFromQuotation, loggedInOperator, form.reset]);


  const watchedJobItems = form.watch('jobItems');
  const watchedDiscountType = form.watch('discountType');
  const watchedDiscountValue = form.watch('discountValue');
  const watchedClientName = form.watch('clientName');
  const watchedCompanyName = form.watch('companyName');

  // Auto-fill logic from contacts (Name match)
  // Logic updated to allow triggers in Edit Mode if details are empty
  useEffect(() => {
    if (!watchedClientName) return;

    const match = contacts.find(c => c.name && c.name.toLowerCase() === watchedClientName.toLowerCase());
    if (match) {
        const currentDetails = form.getValues('clientDetails');
        // Only fill if details are empty. This prevents overwriting existing job data on load
        // while allowing users to "re-add" by clearing the details field first.
        if (!currentDetails || currentDetails.trim() === '') {
            form.setValue('companyName', match.companyName || '');
            
            const details = [
                match.companyName,
                match.phone,
                match.email,
                `${match.street || ''}${match.zip ? ', ' + match.zip : ''}`
            ].filter(Boolean).join('\n');
            
            form.setValue('clientDetails', details);
        }
    }
  }, [watchedClientName, contacts, form]);

  // Auto-fill logic from contacts (Company Name match)
  useEffect(() => {
    if (!watchedCompanyName) return;

    const match = contacts.find(c => c.companyName?.toLowerCase() === watchedCompanyName.toLowerCase());
    if (match) {
        const currentDetails = form.getValues('clientDetails');
        if (!currentDetails || currentDetails.trim() === '') {
            if (!form.getValues('clientName')) {
                form.setValue('clientName', match.name || '');
            }
            
            const details = [
                match.companyName,
                match.phone,
                match.email,
                `${match.street || ''}${match.zip ? ', ' + match.zip : ''}`
            ].filter(Boolean).join('\n');
            
            form.setValue('clientDetails', details);
        }
    }
  }, [watchedCompanyName, contacts, form]);

  const discountType = form.watch('discountType');
  const discountValue = form.watch('discountValue');

  useEffect(() => {
    let sub = 0;
    let vat = 0;
    (watchedJobItems || []).forEach(item => {
      const itemPrice = Number(item.price) || 0;
      sub += itemPrice;
      if (item.vatApplied) {
        vat += itemPrice * 0.20;
      }
    });

    let discAmount = 0;
    if (discountType === 'percentage') {
      discAmount = sub * ((Number(discountValue) || 0) / 100);
    } else {
      discAmount = Number(discountValue) || 0;
    }

    discAmount = Math.min(discAmount, sub);
    const subAfterDisc = sub - discAmount;
    
    let recalculatedVat = 0;
    if (sub > 0) {
        const discRatio = subAfterDisc / sub;
        recalculatedVat = vat * discRatio;
    }
    const total = subAfterDisc + recalculatedVat;

    const tolerance = 0.001;
    if (Math.abs((form.getValues('subTotal') || 0) - sub) > tolerance) {
        form.setValue('subTotal', sub);
    }
    if (Math.abs((form.getValues('discountAmount') || 0) - discAmount) > tolerance) {
        form.setValue('discountAmount', discAmount);
    }
    if (Math.abs((form.getValues('subTotalAfterDiscount') || 0) - subAfterDisc) > tolerance) {
        form.setValue('subTotalAfterDiscount', subAfterDisc);
    }
    if (Math.abs((form.getValues('vatAmount') || 0) - recalculatedVat) > tolerance) {
        form.setValue('vatAmount', recalculatedVat);
    }
    if (Math.abs((form.getValues('totalAmount') || 0) - total) > tolerance) {
        form.setValue('totalAmount', total);
    }
  }, [watchedJobItems, discountType, discountValue, form]);

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      const sanitizedData = {
        ...data,
        date: data.date ? new Date(data.date) : new Date(),
        deliveryBy: data.deliveryBy ? new Date(data.deliveryBy) : null,
      };
      
      const result = isEditMode && jobSheetToEdit?.id
        ? await updateJobSheet(jobSheetToEdit.id, sanitizedData as any, loggedInOperator!)
        : await addJobSheet(sanitizedData as any, jobSheetToCreateFromQuotation);

      if (result.success && result.jobSheet) {
        if (isEditMode) {
          toast({ title: 'Success', description: 'Job sheet updated successfully.' });
        } else if (isConversionMode) {
          toast({ title: 'Success', description: `Job Sheet ${result.jobSheet.jobId} created from quotation.` });
        } else {
          setLastJobSheet(result.jobSheet);
          toast({ title: 'Success', description: `Job Sheet ${result.jobSheet.jobId} created.` });
        }
        if (onJobSheetAdded) onJobSheetAdded(result.jobSheet);
        if (!isEditMode) form.reset(getFreshDefaultValues(loggedInOperator));
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    });
  };

  const cancelEdit = () => { if(onJobSheetAdded) onJobSheetAdded(); };
  
  return (
    <>
      <JobSheetViewDialog 
        jobSheet={lastJobSheet}
        isOpen={!!lastJobSheet && !isEditMode && !isConversionMode}
        onClose={() => setLastJobSheet(null)}
      />
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-7xl mx-auto">
         {!isEditMode && !isConversionMode && (
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-6 sm:p-7 shadow-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-indigo-200 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span>Job Sheet Creator</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Create New Job Sheet</h2>
                  <p className="text-xs sm:text-sm text-indigo-200 mt-1">Configure client details, production line items, and workflow status.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" asChild className="rounded-2xl bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md font-bold">
                    <Link href="/contact-list" target="_blank">
                      <UserPlus className="mr-2 h-4 w-4 text-indigo-300" />
                      Add Contact
                    </Link>
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isPending}
                    className="rounded-2xl font-black bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:opacity-90 text-white shadow-lg px-6 h-10 text-sm"
                  >
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isEditMode ? "Update" : "Save Job Sheet"}
                  </Button>
                </div>
              </div>
            </div>
        )}
        
        {isPaid && (
            <Alert variant="destructive" className="rounded-2xl mb-6">
                <Lock className="h-4 w-4" />
                <AlertTitle className="font-bold">Editing Locked</AlertTitle>
                <AlertDescription>
                    This job sheet has payments recorded against it. Financial details (items, prices, client) cannot be edited. You can still update the status or notes.
                </AlertDescription>
            </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                {/* Client Info Card - Light Blue Theme */}
                <Card className="rounded-3xl border border-blue-200/80 dark:border-blue-800/40 bg-blue-50/40 dark:bg-blue-950/20 backdrop-blur-md shadow-md overflow-hidden">
                    <CardHeader className="bg-blue-100/70 dark:bg-blue-900/40 border-b border-blue-200/60 dark:border-blue-800/50 px-6 py-4 flex flex-row items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-600/10 text-blue-700 dark:text-blue-300 font-bold">
                          <User className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-base font-black tracking-tight text-blue-950 dark:text-blue-100">Client Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="clientName" className="font-bold text-xs uppercase tracking-wider text-blue-900 dark:text-blue-300">Client Name (Full Name)</Label>
                                <Input id="clientName" {...form.register('clientName')} disabled={isPaid} list="contacts-list" autoComplete="off" placeholder="Enter or search client name..." className="rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90 border-blue-200/80" />
                                <datalist id="contacts-list">
                                    {contacts.map(c => <option key={c.id} value={c.name} />)}
                                </datalist>
                                {form.formState.errors.clientName && <p className="text-sm text-destructive">{form.formState.errors.clientName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="companyName" className="font-bold text-xs uppercase tracking-wider text-blue-900 dark:text-blue-300">Company Name</Label>
                                <Input id="companyName" {...form.register('companyName')} disabled={isPaid} list="companies-list" autoComplete="off" placeholder="Enter or search company..." className="rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90 border-blue-200/80" />
                                <datalist id="companies-list">
                                    {[...new Set(contacts.map(c => c.companyName).filter(Boolean))].map((comp, idx) => (
                                        <option key={idx} value={comp!} />
                                    ))}
                                </datalist>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="clientDetails" className="font-bold text-xs uppercase tracking-wider text-blue-900 dark:text-blue-300">Client Details (Address, Phone, Email...)</Label>
                            <Textarea id="clientDetails" {...form.register('clientDetails')} disabled={isPaid} rows={3} placeholder="Manual entry allowed. Will not affect contact list." className="rounded-2xl bg-white/90 dark:bg-slate-900/90 border-blue-200/80" />
                        </div>
                    </CardContent>
                </Card>

                {/* Job Line Items Card - Light Purple Theme */}
                <Card className="rounded-3xl border border-purple-200/80 dark:border-purple-800/40 bg-purple-50/40 dark:bg-purple-950/20 backdrop-blur-md shadow-md overflow-hidden">
                    <CardHeader className="bg-purple-100/70 dark:bg-purple-900/40 border-b border-purple-200/60 dark:border-purple-800/50 px-6 py-4 flex flex-row items-center gap-3">
                        <div className="p-2 rounded-xl bg-purple-600/10 text-purple-700 dark:text-purple-300 font-bold">
                          <Package className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-base font-black tracking-tight text-purple-950 dark:text-purple-100">Job Production Items</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-6">
                         <div className="grid grid-cols-12 gap-2 items-center bg-purple-100/80 dark:bg-purple-900/50 p-2.5 rounded-xl border border-purple-200/70 text-purple-950 dark:text-purple-200 font-extrabold text-xs uppercase tracking-wider">
                            <div className="col-span-6">Description</div>
                            <div className="col-span-2 text-center">Qty</div>
                            <div className="col-span-2 text-right">Price (£)</div>
                            <div className="col-span-1 text-center">VAT</div>
                            <div className="col-span-1"></div>
                        </div>

                        {fields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-12 gap-2.5 items-start bg-white/90 dark:bg-slate-900/90 p-3 rounded-2xl border border-purple-200/60 dark:border-purple-800/60 hover:border-purple-400 transition-all duration-200 shadow-sm">
                            <div className="col-span-6">
                                <Textarea {...form.register(`jobItems.${index}.description`)} placeholder="Item description & specification" className="min-h-[42px] rounded-xl text-sm" disabled={isPaid}/>
                            </div>
                            <div className="col-span-2">
                                <Input type="number" {...form.register(`jobItems.${index}.quantity`, { valueAsNumber: true })} placeholder="Qty" disabled={isPaid} className="text-center rounded-xl h-11 font-bold" />
                            </div>
                            <div className="col-span-2">
                                <Input type="number" step="0.01" {...form.register(`jobItems.${index}.price`, { valueAsNumber: true })} placeholder="0.00" disabled={isPaid} className="text-right rounded-xl h-11 font-bold" />
                            </div>
                            <div className="col-span-1 flex items-center justify-center h-11">
                                <Controller
                                    control={form.control}
                                    name={`jobItems.${index}.vatApplied`}
                                    render={({ field: { value, onChange } }) => (<Checkbox checked={value} onCheckedChange={onChange} disabled={isPaid} className="h-5 w-5 rounded-md" />)}
                                />
                            </div>
                            <div className="col-span-1 flex items-center justify-center h-11">
                                <Button type="button" variant="destructive" size="icon" onClick={() => fields.length > 1 && remove(index)} disabled={fields.length <= 1 || isPaid} className="rounded-xl h-9 w-9">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        ))}
                        {form.formState.errors.jobItems && <p className="text-sm text-destructive font-semibold">{form.formState.errors.jobItems.message || form.formState.errors.jobItems.root?.message}</p>}
                        
                        <Button type="button" variant="outline" onClick={() => append({ description: '', quantity: 1, price: 0, vatApplied: false })} disabled={isPaid} className="w-full py-3 rounded-2xl border-2 border-dashed border-purple-300 hover:border-purple-600 text-purple-700 bg-purple-50 hover:bg-purple-100 font-extrabold transition-all">
                            <PlusCircle className="mr-2 h-4 w-4 text-purple-600" /> Add Production Item Line
                        </Button>
                    </CardContent>
                </Card>

                 {/* Notes & References Card - Light Amber Theme */}
                 <Card className="rounded-3xl border border-amber-200/80 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/20 backdrop-blur-md shadow-md overflow-hidden">
                    <CardHeader className="bg-amber-100/70 dark:bg-amber-900/40 border-b border-amber-200/60 dark:border-amber-800/50 px-6 py-4 flex flex-row items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-600/10 text-amber-700 dark:text-amber-300 font-bold">
                          <FileText className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-base font-black tracking-tight text-amber-950 dark:text-amber-100">Notes & Internal References</CardTitle>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-4 p-6">
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="specialNote" className="font-bold text-xs uppercase tracking-wider text-amber-900 dark:text-amber-300">Special Production Instructions / Notes</Label>
                            <Textarea id="specialNote" {...form.register('specialNote')} className="rounded-2xl bg-white/90 dark:bg-slate-900/90 border-amber-200/80" rows={3} placeholder="Special instructions for print operators..." />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="irNumber" className="font-bold text-xs uppercase tracking-wider text-amber-900 dark:text-amber-300">IR Number</Label>
                            <Input id="irNumber" {...form.register('irNumber')} className="rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90 border-amber-200/80" placeholder="e.g. IR-2026-001" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tid" className="font-bold text-xs uppercase tracking-wider text-amber-900 dark:text-amber-300">Transaction ID (Optional)</Label>
                            <Input id="tid" {...form.register('tid')} placeholder="e.g. TID0001" disabled={isPaid} className="rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90 border-amber-200/80" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
                {/* Workflow & Dates Card - Light Emerald Theme */}
                <Card className="rounded-3xl border border-emerald-200/80 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 backdrop-blur-md shadow-md overflow-hidden">
                    <CardHeader className="bg-emerald-100/70 dark:bg-emerald-900/40 border-b border-emerald-200/60 dark:border-emerald-800/50 px-6 py-4 flex flex-row items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 font-bold">
                          <SlidersHorizontal className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-base font-black tracking-tight text-emerald-950 dark:text-emerald-100">Workflow & Dates</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-6">
                        <div className="space-y-2">
                            <Label htmlFor="operator" className="font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-300">Assigned Operator</Label>
                            <Controller name="operator" control={form.control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value} disabled={isConversionMode || !isEditMode}>
                                <SelectTrigger className="rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90 border-emerald-200/80"><SelectValue placeholder="Select Operator" /></SelectTrigger>
                                <SelectContent>{dynamicOperators.map(op => <SelectItem key={op.id} value={op.id}>{op.id}</SelectItem>)}</SelectContent>
                            </Select>
                            )} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="date" className="font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-300">Job Date</Label>
                            <Controller name="date" control={form.control} render={({ field }) => (
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button variant="outline" className={cn('w-full justify-start text-left font-normal rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90 border-emerald-200/80', !field.value && 'text-muted-foreground')} disabled={isPaid}>
                                    <CalendarIcon className="mr-2 h-4 w-4 text-emerald-600" />
                                    {field.value ? format(field.value, 'PPP', { locale: enGB }) : <span>Pick a date</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={field.onChange} initialFocus /></PopoverContent>
                            </Popover>
                            )} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="deliveryBy" className="font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-300">Delivery Due Date</Label>
                            <Controller name="deliveryBy" control={form.control} render={({ field }) => (
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button variant="outline" className={cn('w-full justify-start text-left font-normal rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90 border-emerald-200/80', !field.value && 'text-muted-foreground')}>
                                    <CalendarIcon className="mr-2 h-4 w-4 text-emerald-600" />
                                    {field.value ? format(field.value, 'PPP', { locale: enGB }) : <span>Pick a date</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={field.onChange} /></PopoverContent>
                            </Popover>
                            )} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status" className="font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-300">Workflow Status</Label>
                            <Controller name="status" control={form.control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="rounded-2xl h-11 font-semibold bg-white/90 dark:bg-slate-900/90 border-emerald-200/80"><SelectValue /></SelectTrigger>
                                <SelectContent>{jobSheetStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                            )} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="type" className="font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-300">Document Type</Label>
                            <Controller name="type" control={form.control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="rounded-2xl h-11 font-semibold bg-white/90 dark:bg-slate-900/90 border-emerald-200/80"><SelectValue /></SelectTrigger>
                                <SelectContent>{jobSheetTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                            </Select>
                            )} />
                        </div>
                    </CardContent>
                </Card>

                 {/* Light Vibrant Financial Summary Card */}
                 <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-100/90 via-purple-50/90 to-rose-100/90 dark:from-indigo-950/60 dark:via-purple-950/50 dark:to-rose-950/60 text-slate-900 dark:text-slate-100 p-6 shadow-xl border-2 border-indigo-200 dark:border-indigo-800/80">
                    <div className="flex items-center justify-between border-b border-indigo-200/80 dark:border-indigo-800/80 pb-3 mb-4">
                      <span className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300">Financial Summary</span>
                      <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-black">Live Total</span>
                    </div>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="discountValue" className="font-bold text-xs uppercase tracking-wider text-indigo-900 dark:text-indigo-300">Discount</Label>
                            <div className="flex gap-2">
                                <Input id="discountValue" type="number" step="0.01" {...form.register('discountValue', { valueAsNumber: true })} disabled={isPaid} className="rounded-xl bg-white/90 dark:bg-slate-900/90 border-indigo-200 h-10 font-bold" />
                                <Controller
                                    name="discountType"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value} disabled={isPaid}>
                                            <SelectTrigger className="w-[90px] rounded-xl bg-white/90 dark:bg-slate-900/90 border-indigo-200 h-10 font-bold"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="amount">£</SelectItem>
                                                <SelectItem value="percentage">%</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                        </div>
                        <div className="pt-2 space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400 font-bold">Subtotal</span><span className="font-extrabold text-slate-900 dark:text-slate-100">£{form.watch('subTotal')?.toFixed(2) || '0.00'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400 font-bold">Discount</span><span className="font-extrabold text-rose-600 dark:text-rose-400">- £{form.watch('discountAmount')?.toFixed(2) || '0.00'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400 font-bold">Subtotal (after disc.)</span><span className="font-extrabold text-slate-900 dark:text-slate-100">£{form.watch('subTotalAfterDiscount')?.toFixed(2) || '0.00'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400 font-bold">VAT (20%)</span><span className="font-extrabold text-slate-900 dark:text-slate-100">£{form.watch('vatAmount')?.toFixed(2) || '0.00'}</span></div>
                            <div className="border-t border-indigo-200/80 dark:border-indigo-800/80 pt-4 mt-3">
                              <div className="flex justify-between items-baseline">
                                <span className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200">Grand Total</span>
                                <span className="text-3xl font-black text-indigo-900 dark:text-amber-300 tracking-tight">£{form.watch('totalAmount')?.toFixed(2) || '0.00'}</span>
                              </div>
                            </div>

                            {/* Integrated Submit & Cancel Buttons */}
                            <div className="pt-4 border-t border-indigo-200/80 dark:border-indigo-800/80 mt-4 flex flex-col gap-2.5">
                                <Button
                                    type="submit"
                                    disabled={isPending}
                                    className="w-full h-12 rounded-2xl font-black text-base bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:opacity-95 text-white shadow-xl hover:shadow-amber-500/25 transition-all transform hover:-translate-y-0.5"
                                >
                                    {isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                                    {isEditMode ? "Update Job Sheet" : "Create Job Sheet"}
                                </Button>
                                {(isEditMode || isConversionMode) && (
                                    <Button type="button" variant="outline" onClick={cancelEdit} className="w-full rounded-2xl h-10 font-bold bg-white/80 dark:bg-slate-900/80 border-indigo-200">
                                        Cancel
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </form>
    </>
  );
}
