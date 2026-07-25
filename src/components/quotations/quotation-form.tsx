'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, PlusCircle, Trash2, Lock, UserPlus, Sparkles, User, Package, FileText, SlidersHorizontal, CreditCard } from 'lucide-react';
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
import { addQuotation, updateQuotation } from '@/lib/server-actions-quotations';
import { QuotationSchema, quotationStatus, type Quotation, type Operator, jobSheetTypes as quotationTypes, type Contact } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { QuotationViewDialog } from './quotation-view-dialog';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useSession } from '../auth/session-provider';
import { Separator } from '../ui/separator';

type QuotationFormProps = {
  onQuotationAdded?: () => void;
  quotationToEdit?: Quotation | null;
};

type FormValues = Omit<Quotation, 'id' | 'createdAt' | 'quotationId'>;


const getFreshDefaultValues = (operator: Operator | null): Partial<FormValues> => ({
  date: new Date(),
  operator: operator || undefined,
  clientName: '',
  companyName: '',
  clientDetails: '',
  jobItems: [{ description: '', quantity: 1, price: 0, vatApplied: false }],
  subTotal: 0,
  vatAmount: 0,
  totalAmount: 0,
  status: 'Hold',
  specialNote: '',
  jid: '',
  deliveryBy: undefined,
  type: 'Quotation',
  tid: '',
  paidAmount: 0,
  dueAmount: 0,
  paymentStatus: 'Unpaid',
});

export function QuotationForm({ onQuotationAdded, quotationToEdit }: QuotationFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { operator: loggedInOperator, operators: dynamicOperators } = useSession();
  const [lastQuotation, setLastQuotation] = useState<Quotation | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const isEditMode = !!quotationToEdit;
  const isLocked = isEditMode && !!quotationToEdit.jid;

  const form = useForm<FormValues>({
    resolver: zodResolver(QuotationSchema.omit({ id: true, createdAt: true, quotationId: true })) as any,
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
    if (quotationToEdit) {
        const deliveryByDate = quotationToEdit.deliveryBy ? new Date(quotationToEdit.deliveryBy) : undefined;
        form.reset({
            ...(quotationToEdit as any),
            date: new Date(quotationToEdit.date),
            deliveryBy: deliveryByDate,
            jid: quotationToEdit.jid || '',
            specialNote: quotationToEdit.specialNote || '',
            clientDetails: quotationToEdit.clientDetails || '',
            tid: quotationToEdit.tid || '',
            companyName: quotationToEdit.companyName || '',
        });
    } else {
        form.reset(getFreshDefaultValues(loggedInOperator));
    }
  }, [quotationToEdit, form, loggedInOperator]);


  const watchedJobItems = form.watch('jobItems');
  const watchedClientName = form.watch('clientName');
  const watchedCompanyName = form.watch('companyName');
  
  // Auto-fill logic from contacts (Name match)
  // Logic updated to allow triggers in Edit Mode if details are empty
  useEffect(() => {
    if (!watchedClientName) return;

    const match = contacts.find(c => c.name && c.name.toLowerCase() === watchedClientName.toLowerCase());
    if (match) {
        const currentDetails = form.getValues('clientDetails');
        // Only auto-fill if details are currently empty, to avoid overwriting manual edits
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

  // Real-time derived calculations (item.price is the line total price)
  let subTotal = 0;
  let vatableSubTotal = 0;
  (watchedJobItems || []).forEach(item => {
    const price = Number(item?.price) || 0;
    subTotal += price;
    if (item?.vatApplied) {
      vatableSubTotal += price;
    }
  });

  const vatAmount = vatableSubTotal * 0.20;
  const totalAmount = subTotal + vatAmount;

  useEffect(() => {
    const tolerance = 0.001;
    if (Math.abs((form.getValues('subTotal') || 0) - subTotal) > tolerance) {
      form.setValue('subTotal', subTotal);
    }
    if (Math.abs((form.getValues('vatAmount') || 0) - vatAmount) > tolerance) {
      form.setValue('vatAmount', vatAmount);
    }
    if (Math.abs((form.getValues('totalAmount') || 0) - totalAmount) > tolerance) {
      form.setValue('totalAmount', totalAmount);
    }
  }, [subTotal, vatAmount, totalAmount, form]);


  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      
      const sanitizedData = {
        ...data,
        date: data.date ? new Date(data.date) : new Date(),
        deliveryBy: data.deliveryBy ? new Date(data.deliveryBy) : null,
      };
      
      const result = isEditMode && quotationToEdit?.id
        ? await updateQuotation(quotationToEdit.id, sanitizedData as any, loggedInOperator!)
        : await addQuotation({ ...sanitizedData, quotationId: undefined } as any);

      if (result.success && result.quotation) {
        if (isEditMode) {
          toast({ title: 'Success', description: 'Quotation updated successfully.' });
        } else {
          setLastQuotation(result.quotation);
          toast({ title: 'Success', description: `Quotation ${result.quotation.quotationId} created.` });
        }
        if (!isEditMode) {
            form.reset(getFreshDefaultValues(loggedInOperator));
        }
        onQuotationAdded?.();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.message || 'Validation failed. Please check the form.',
        });
      }
    });
  };

  const cancelEdit = () => {
    onQuotationAdded?.(); 
  };
  
  return (
    <>
      <QuotationViewDialog 
        quotation={lastQuotation}
        isOpen={!!lastQuotation && !isEditMode}
        onClose={() => setLastQuotation(null)}
      />
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-7xl mx-auto">
         {!isEditMode && (
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-6 sm:p-7 shadow-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-indigo-200 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span>Quotation Studio</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Create New Quotation</h2>
                  <p className="text-xs sm:text-sm text-indigo-200 mt-1">Generate professional cost estimates and proposals for your print clients.</p>
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
                    {isEditMode ? "Update" : "Save Quotation"}
                  </Button>
                </div>
              </div>
            </div>
        )}
        
        {isLocked && (
            <Alert variant="destructive" className="rounded-2xl mb-6">
                <Lock className="h-4 w-4" />
                <AlertTitle className="font-bold">Editing Locked</AlertTitle>
                <AlertDescription>
                    This quotation has been converted to a job sheet. Financial details and client information cannot be edited.
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
                                <Input 
                                    id="clientName" 
                                    {...form.register('clientName')} 
                                    disabled={isLocked}
                                    list="quotation-contacts-list"
                                    autoComplete="off"
                                    placeholder="Enter or search client name..."
                                    className="rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90 border-blue-200/80"
                                />
                                <datalist id="quotation-contacts-list">
                                    {contacts.map(c => <option key={c.id} value={c.name} />)}
                                </datalist>
                                {form.formState.errors.clientName && <p className="text-sm text-destructive">{form.formState.errors.clientName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="companyName" className="font-bold text-xs uppercase tracking-wider text-blue-900 dark:text-blue-300">Company Name</Label>
                                <Input 
                                    id="companyName" 
                                    {...form.register('companyName')} 
                                    disabled={isLocked}
                                    list="quotation-companies-list"
                                    autoComplete="off"
                                    placeholder="Enter or search company..."
                                    className="rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90 border-blue-200/80"
                                />
                                <datalist id="quotation-companies-list">
                                    {[...new Set(contacts.map(c => c.companyName).filter(Boolean))].map((comp, idx) => (
                                        <option key={idx} value={comp!} />
                                    ))}
                                </datalist>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="clientDetails" className="font-bold text-xs uppercase tracking-wider text-blue-900 dark:text-blue-300">Client Details (Address, Phone, Email...)</Label>
                            <Textarea id="clientDetails" {...form.register('clientDetails')} disabled={isLocked} rows={3} placeholder="Manual entry allowed. Will not affect contact list." className="rounded-2xl bg-white/90 dark:bg-slate-900/90 border-blue-200/80" />
                        </div>
                    </CardContent>
                </Card>

                {/* Quotation Line Items - Light Purple Theme */}
                <Card className="rounded-3xl border border-purple-200/80 dark:border-purple-800/40 bg-purple-50/40 dark:bg-purple-950/20 backdrop-blur-md shadow-md overflow-hidden">
                    <CardHeader className="bg-purple-100/70 dark:bg-purple-900/40 border-b border-purple-200/60 dark:border-purple-800/50 px-6 py-4 flex flex-row items-center gap-3">
                        <div className="p-2 rounded-xl bg-purple-600/10 text-purple-700 dark:text-purple-300 font-bold">
                          <Package className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-base font-black tracking-tight text-purple-950 dark:text-purple-100">Quotation Line Items</CardTitle>
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
                                <Textarea {...form.register(`jobItems.${index}.description`)} placeholder="Item description & specification" className="min-h-[42px] rounded-xl text-sm" disabled={isLocked}/>
                            </div>
                            <div className="col-span-2">
                                <Input type="number" {...form.register(`jobItems.${index}.quantity`, { valueAsNumber: true })} placeholder="Qty" disabled={isLocked} className="text-center rounded-xl h-11 font-bold" />
                            </div>
                            <div className="col-span-2">
                                <Input type="number" step="0.01" {...form.register(`jobItems.${index}.price`, { valueAsNumber: true })} placeholder="0.00" disabled={isLocked} className="text-right rounded-xl h-11 font-bold" />
                            </div>
                            <div className="col-span-1 flex items-center justify-center h-11">
                                <Controller
                                    control={form.control}
                                    name={`jobItems.${index}.vatApplied`}
                                    render={({ field: { value, onChange } }) => (<Checkbox checked={value} onCheckedChange={onChange} disabled={isLocked} className="h-5 w-5 rounded-md"/>)}
                                />
                            </div>
                            <div className="col-span-1 flex items-center justify-center h-11">
                                <Button type="button" variant="destructive" size="icon" onClick={() => fields.length > 1 && remove(index)} disabled={fields.length <= 1 || isLocked} className="rounded-xl h-9 w-9">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        ))}
                        {form.formState.errors.jobItems && <p className="text-sm text-destructive font-semibold">{form.formState.errors.jobItems.message || form.formState.errors.jobItems.root?.message}</p>}
                        
                        <Button type="button" variant="outline" onClick={() => append({ description: '', quantity: 1, price: 0, vatApplied: false })} disabled={isLocked} className="w-full py-3 rounded-2xl border-2 border-dashed border-purple-300 hover:border-purple-600 text-purple-700 bg-purple-50 hover:bg-purple-100 font-extrabold transition-all">
                            <PlusCircle className="mr-2 h-4 w-4 text-purple-600" /> Add Item Line Row
                        </Button>
                    </CardContent>
                </Card>

                 {/* Notes & References Card - Light Amber Theme */}
                 <Card className="rounded-3xl border border-amber-200/80 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/20 backdrop-blur-md shadow-md overflow-hidden">
                    <CardHeader className="bg-amber-100/70 dark:bg-amber-900/40 border-b border-amber-200/60 dark:border-amber-800/50 px-6 py-4 flex flex-row items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-600/10 text-amber-700 dark:text-amber-300 font-bold">
                          <FileText className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-base font-black tracking-tight text-amber-950 dark:text-amber-100">Proposal Notes & References</CardTitle>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-4 p-6">
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="specialNote" className="font-bold text-xs uppercase tracking-wider text-amber-900 dark:text-amber-300">Special Note / Proposal Notes</Label>
                            <Textarea id="specialNote" {...form.register('specialNote')} className="rounded-2xl bg-white/90 dark:bg-slate-900/90 border-amber-200/80" rows={3} placeholder="Notes to include in client quotation..." />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="tid" className="font-bold text-xs uppercase tracking-wider text-amber-900 dark:text-amber-300">Transaction ID (Optional)</Label>
                            <Input id="tid" {...form.register('tid')} placeholder="e.g. TID0001" disabled={isLocked} className="rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90 border-amber-200/80" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
                {/* Quotation Details Card - Light Emerald Theme */}
                <Card className="rounded-3xl border border-emerald-200/80 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 backdrop-blur-md shadow-md overflow-hidden">
                    <CardHeader className="bg-emerald-100/70 dark:bg-emerald-900/40 border-b border-emerald-200/60 dark:border-emerald-800/50 px-6 py-4 flex flex-row items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 font-bold">
                          <SlidersHorizontal className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-base font-black tracking-tight text-emerald-950 dark:text-emerald-100">Quotation Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-6">
                        <div className="space-y-2">
                            <Label htmlFor="operator" className="font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-300">Assigned Operator</Label>
                            <Controller name="operator" control={form.control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value} disabled={!isEditMode}>
                                <SelectTrigger className="rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90 border-emerald-200/80"><SelectValue placeholder="Select Operator" /></SelectTrigger>
                                <SelectContent>{dynamicOperators.map(op => <SelectItem key={op.id} value={op.id}>{op.id}</SelectItem>)}</SelectContent>
                            </Select>
                            )} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="date" className="font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-300">Quotation Date</Label>
                            <Controller name="date" control={form.control} render={({ field }) => (
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button variant="outline" className={cn('w-full justify-start text-left font-normal rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90 border-emerald-200/80', !field.value && 'text-muted-foreground')} disabled={isLocked}>
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
                            <Label htmlFor="status" className="font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-300">Quotation Status</Label>
                            <Controller name="status" control={form.control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="rounded-2xl h-11 font-semibold bg-white/90 dark:bg-slate-900/90 border-emerald-200/80"><SelectValue /></SelectTrigger>
                                <SelectContent>{quotationStatus.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                            )} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="type" className="font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-300">Document Type</Label>
                            <Controller name="type" control={form.control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value} disabled>
                                <SelectTrigger className="rounded-2xl h-11 font-semibold bg-white/90 dark:bg-slate-900/90 border-emerald-200/80"><SelectValue /></SelectTrigger>
                                <SelectContent>{quotationTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                            </Select>
                            )} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="jid" className="font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-300">Converted Job Sheet ID</Label>
                            <Input id="jid" {...form.register('jid')} readOnly className="rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90 border-emerald-200/80 font-mono text-xs" />
                        </div>
                    </CardContent>
                </Card>

                 {/* Light Vibrant Financial Summary Card */}
                 <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-100/90 via-purple-50/90 to-rose-100/90 dark:from-indigo-950/60 dark:via-purple-950/50 dark:to-rose-950/60 text-slate-900 dark:text-slate-100 p-6 shadow-xl border-2 border-indigo-200 dark:border-indigo-800/80">
                    <div className="flex items-center justify-between border-b border-indigo-200/80 dark:border-indigo-800/80 pb-3 mb-4">
                      <span className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300">Financial Summary</span>
                      <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-black">Proposal Calculation</span>
                    </div>

                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400 font-bold">Subtotal</span><span className="font-extrabold text-slate-900 dark:text-slate-100">£{subTotal.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400 font-bold">VAT (20%)</span><span className="font-extrabold text-slate-900 dark:text-slate-100">£{vatAmount.toFixed(2)}</span></div>
                        
                        <div className="border-t border-indigo-200/80 dark:border-indigo-800/80 pt-4 mt-3">
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200">Grand Total</span>
                            <span className="text-3xl font-black text-indigo-900 dark:text-amber-300 tracking-tight">£{totalAmount.toFixed(2)}</span>
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
                                {isEditMode ? "Update Quotation" : "Create Quotation"}
                            </Button>
                            {isEditMode && (
                                <Button type="button" variant="outline" onClick={cancelEdit} className="w-full rounded-2xl h-10 font-bold bg-white/80 dark:bg-slate-900/80 border-indigo-200">
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </form>
    </>
  );
}
