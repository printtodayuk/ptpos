
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, PlusCircle, Trash2, Lock, UserPlus } from 'lucide-react';
import { enGB } from 'date-fns/locale';
import Link from 'next/link';

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
import { getContacts } from '@/lib/server-actions-contacts';
import { QuotationSchema, operators, quotationStatus, type Quotation, type Operator, jobSheetTypes as quotationTypes, type Contact } from '@/lib/types';
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
  const { operator: loggedInOperator } = useSession();
  const [lastQuotation, setLastQuotation] = useState<Quotation | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const isEditMode = !!quotationToEdit;
  const isLocked = isEditMode && !!quotationToEdit.jid;

  const form = useForm<FormValues>({
    resolver: zodResolver(QuotationSchema.omit({ id: true, createdAt: true, quotationId: true })),
    defaultValues: getFreshDefaultValues(loggedInOperator),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'jobItems',
  });

  useEffect(() => {
    getContacts().then(setContacts);
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
  useEffect(() => {
    if (!watchedClientName || isEditMode) return;

    const match = contacts.find(c => c.name.toLowerCase() === watchedClientName.toLowerCase());
    if (match) {
        form.setValue('companyName', match.companyName || '');
        
        const details = [
            match.companyName,
            match.phone,
            match.email,
            `${match.street || ''}${match.zip ? ', ' + match.zip : ''}`
        ].filter(Boolean).join('\n');
        
        form.setValue('clientDetails', details);
    }
  }, [watchedClientName, contacts, form, isEditMode]);

  // Auto-fill logic from contacts (Company Name match)
  useEffect(() => {
    if (!watchedCompanyName || isEditMode) return;

    const match = contacts.find(c => c.companyName?.toLowerCase() === watchedCompanyName.toLowerCase());
    if (match) {
        if (!form.getValues('clientName')) {
            form.setValue('clientName', match.name);
        }
        
        const details = [
            match.companyName,
            match.phone,
            match.email,
            `${match.street || ''}${match.zip ? ', ' + match.zip : ''}`
        ].filter(Boolean).join('\n');
        
        form.setValue('clientDetails', details);
    }
  }, [watchedCompanyName, contacts, form, isEditMode]);

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
      
      const result = isEditMode && quotationToEdit?.id
        ? await updateQuotation(quotationToEdit.id, data, loggedInOperator!)
        : await addQuotation({ ...data, quotationId: undefined });

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
        <form onSubmit={form.handleSubmit(onSubmit)}>
         {!isEditMode && (
            <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Create Quotation</h2>
                <p className="text-muted-foreground">Fill in the details to create a new quotation.</p>
              </div>
              <Button variant="outline" asChild className="border-primary/20 hover:bg-primary/5">
                <Link href="/contact" target="_blank">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Contact
                </Link>
              </Button>
            </div>
        )}
        
        {isLocked && (
            <Alert variant="destructive" className="mb-6">
                <Lock className="h-4 w-4" />
                <AlertTitle>Editing Locked</AlertTitle>
                <AlertDescription>
                    This quotation has been converted to a job sheet. Financial details and client information cannot be edited.
                </AlertDescription>
            </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Client Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="clientName">Client Name (Full Name)</Label>
                                <Input 
                                    id="clientName" 
                                    {...form.register('clientName')} 
                                    disabled={isLocked}
                                    list="quotation-contacts-list"
                                    autoComplete="off"
                                />
                                <datalist id="quotation-contacts-list">
                                    {contacts.map(c => <option key={c.id} value={c.name} />)}
                                </datalist>
                                {form.formState.errors.clientName && <p className="text-sm text-destructive">{form.formState.errors.clientName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="companyName">Company Name</Label>
                                <Input 
                                    id="companyName" 
                                    {...form.register('companyName')} 
                                    disabled={isLocked}
                                    list="quotation-companies-list"
                                    autoComplete="off"
                                />
                                <datalist id="quotation-companies-list">
                                    {[...new Set(contacts.map(c => c.companyName).filter(Boolean))].map((comp, idx) => (
                                        <option key={idx} value={comp!} />
                                    ))}
                                </datalist>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="clientDetails">Client Details (Address, Phone, etc.)</Label>
                            <Textarea id="clientDetails" {...form.register('clientDetails')} disabled={isLocked} rows={5}/>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Quotation Items</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                         <div className="grid grid-cols-12 gap-2 items-center border-b pb-2">
                            <div className="col-span-6"><Label className="text-xs">Description</Label></div>
                            <div className="col-span-2 text-center"><Label className="text-xs">Qty</Label></div>
                            <div className="col-span-2 text-right"><Label className="text-xs">Total Price (£)</Label></div>
                            <div className="col-span-1 text-center"><Label className="text-xs">VAT</Label></div>
                            <div className="col-span-1"></div>
                        </div>

                        {fields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                            <div className="col-span-6">
                                <Textarea {...form.register(`jobItems.${index}.description`)} placeholder="Item description" className="h-10" disabled={isLocked}/>
                            </div>
                            <div className="col-span-2">
                                <Input type="number" {...form.register(`jobItems.${index}.quantity`, { valueAsNumber: true })} placeholder="Qty" disabled={isLocked} className="text-center" />
                            </div>
                            <div className="col-span-2">
                                <Input type="number" step="0.01" {...form.register(`jobItems.${index}.price`, { valueAsNumber: true })} placeholder="Price" disabled={isLocked} className="text-right" />
                            </div>
                            <div className="col-span-1 flex items-center justify-center h-full">
                                <Controller
                                    control={form.control}
                                    name={`jobItems.${index}.vatApplied`}
                                    render={({ field: { value, onChange } }) => (<Checkbox checked={value} onCheckedChange={onChange} disabled={isLocked}/>)}
                                />
                            </div>
                            <div className="col-span-1 flex items-start h-full">
                                <Button type="button" variant="destructive" size="icon" onClick={() => fields.length > 1 && remove(index)} disabled={fields.length <= 1 || isLocked}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        ))}
                        {form.formState.errors.jobItems && <p className="text-sm text-destructive">{form.formState.errors.jobItems.message || form.formState.errors.jobItems.root?.message}</p>}
                        
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, price: 0, vatApplied: false })} disabled={isLocked}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                        </Button>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>Additional Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="specialNote">Special Note</Label>
                            <Textarea id="specialNote" {...form.register('specialNote')} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="tid">Transaction ID (Optional)</Label>
                            <Input id="tid" {...form.register('tid')} placeholder="e.g. TID0001" disabled={isLocked}/>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <CardHeader><CardTitle>Quotation Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="operator">Operator</Label>
                            <Controller name="operator" control={form.control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value} disabled={!isEditMode}>
                                <SelectTrigger><SelectValue placeholder="Select Operator" /></SelectTrigger>
                                <SelectContent>{operators.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent>
                            </Select>
                            )} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="date">Date</Label>
                            <Controller name="date" control={form.control} render={({ field }) => (
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')} disabled={isLocked}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, 'PPP', { locale: enGB }) : <span>Pick a date</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                            </Popover>
                            )} />
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
                            <Label htmlFor="status">Status</Label>
                            <Controller name="status" control={form.control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{quotationStatus.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                            )} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="type">Type</Label>
                            <Controller name="type" control={form.control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value} disabled>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{quotationTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                            </Select>
                            )} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="jid">JID</Label>
                            <Input id="jid" {...form.register('jid')} readOnly />
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                     <CardHeader><CardTitle>Financials</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="border rounded-lg p-4 space-y-2 bg-muted/50 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">£{subTotal.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">VAT (20%)</span><span className="font-medium">£{vatAmount.toFixed(2)}</span></div>
                            <Separator className="my-2" />
                            <div className="flex justify-between font-bold text-lg text-foreground"><span>Total</span><span>£{totalAmount.toFixed(2)}</span></div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
         <CardFooter className="justify-end gap-2 pt-8">
            {isEditMode && <Button type="button" variant="outline" onClick={cancelEdit}>Cancel</Button>}
            <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? "Update Quotation" : "Create Quotation"}
            </Button>
        </CardFooter>
      </form>
    </>
  );
}
