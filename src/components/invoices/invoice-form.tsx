'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, format } from 'date-fns';
import { Loader2, PlusCircle, Trash2, Calendar as CalendarIcon, Sparkles, User, Package, FileText, SlidersHorizontal, CreditCard } from 'lucide-react';
import { z } from 'zod';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { InvoiceSchema, type Contact } from '@/lib/types';
import type { CompanyProfile, Invoice, JobSheet } from '@/lib/types';
import { saveInvoice } from '@/lib/server-actions-invoices';
import { useToast } from '@/hooks/use-toast';

const CreateInvoiceSchema = InvoiceSchema.omit({ id: true, invoiceId: true, createdAt: true });

type InvoiceFormProps = {
    companyProfiles: CompanyProfile[];
    invoiceToEdit?: Invoice | null;
    jobSheetToInvoice?: JobSheet | null;
    onSuccess: () => void;
    onCancel: () => void;
};

export function InvoiceForm({ companyProfiles, invoiceToEdit, jobSheetToInvoice, onSuccess, onCancel }: InvoiceFormProps) {
    const [isPending, startTransition] = useTransition();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const { toast } = useToast();

    const isEditMode = !!invoiceToEdit;

    const getInitialValues = () => {
        if (invoiceToEdit) {
            return {
                ...invoiceToEdit,
                companyName: invoiceToEdit.companyName || '',
                date: new Date(invoiceToEdit.date),
                dueDate: new Date(invoiceToEdit.dueDate),
            };
        }
        if (jobSheetToInvoice) {
            return {
                companyProfileId: companyProfiles[0]?.id || '',
                clientName: jobSheetToInvoice.clientName || '',
                companyName: jobSheetToInvoice.companyName || '',
                clientAddress: jobSheetToInvoice.clientDetails || [jobSheetToInvoice.companyName, jobSheetToInvoice.clientName].filter(Boolean).join('\n'),
                date: new Date(),
                dueDate: addDays(new Date(), 30),
                items: (jobSheetToInvoice.jobItems || []).map(item => ({
                    description: item.description,
                    quantity: item.quantity,
                    price: item.price,
                    vatApplied: item.vatApplied ?? false,
                })),
                subTotal: jobSheetToInvoice.subTotal || 0,
                discountType: jobSheetToInvoice.discountType || 'amount',
                discountValue: jobSheetToInvoice.discountValue || 0,
                discountAmount: jobSheetToInvoice.discountAmount || 0,
                subTotalAfterDiscount: jobSheetToInvoice.subTotalAfterDiscount || jobSheetToInvoice.subTotal || 0,
                vatAmount: jobSheetToInvoice.vatAmount || 0,
                totalAmount: jobSheetToInvoice.totalAmount || 0,
                notes: `Job Sheet Ref: ${jobSheetToInvoice.jobId}${jobSheetToInvoice.irNumber ? ` | IR: ${jobSheetToInvoice.irNumber}` : ''}${jobSheetToInvoice.specialNote ? `\n\nNote: ${jobSheetToInvoice.specialNote}` : ''}`,
                status: 'Draft' as const,
            };
        }
        return {
            companyProfileId: companyProfiles[0]?.id || '',
            clientName: '',
            companyName: '',
            clientAddress: '',
            date: new Date(),
            dueDate: addDays(new Date(), 30),
            items: [{ description: '', quantity: 1, price: 0, vatApplied: false }],
            subTotal: 0,
            discountType: 'amount' as const,
            discountValue: 0,
            discountAmount: 0,
            subTotalAfterDiscount: 0,
            vatAmount: 0,
            totalAmount: 0,
            notes: companyProfiles[0]?.defaultNotes || '',
            status: 'Draft' as const,
        };
    };

    const form = useForm<z.infer<typeof CreateInvoiceSchema>>({
        resolver: zodResolver(CreateInvoiceSchema),
        defaultValues: getInitialValues(),
    });

    useEffect(() => {
        form.reset(getInitialValues());
    }, [invoiceToEdit, jobSheetToInvoice, companyProfiles]);

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'items',
    });

    const watchedItems = form.watch('items');
    const watchedDiscountType = form.watch('discountType');
    const watchedDiscountValue = form.watch('discountValue');
    const watchedClientName = form.watch('clientName');
    const watchedCompanyName = form.watch('companyName');

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

    // Auto-fill logic from contacts (Name match)
    // Logic updated to allow triggers in Edit Mode if address is empty
    useEffect(() => {
        if (!watchedClientName) return;

        const match = contacts.find(c => 
            c.name && c.name.toLowerCase() === watchedClientName.toLowerCase()
        );

        if (match) {
            const currentAddress = form.getValues('clientAddress');
            // Only fill if address is empty. This prevents overwriting existing invoice data on load
            // while allowing users to "re-add" by clearing the field first.
            if (!currentAddress || currentAddress.trim() === '') {
                form.setValue('companyName', match.companyName || '');
                
                const details = [
                    match.companyName,
                    match.phone,
                    match.email,
                    `${match.street || ''}${match.zip ? ', ' + match.zip : ''}`
                ].filter(Boolean).join('\n');
                
                form.setValue('clientAddress', details);
            }
        }
    }, [watchedClientName, contacts, form]);

    // Auto-fill logic from contacts (Company Name match)
    useEffect(() => {
        if (!watchedCompanyName) return;

        const match = contacts.find(c => 
            c.companyName?.toLowerCase() === watchedCompanyName.toLowerCase()
        );

        if (match) {
            const currentAddress = form.getValues('clientAddress');
            if (!currentAddress || currentAddress.trim() === '') {
                if (!form.getValues('clientName')) {
                    form.setValue('clientName', match.name || '');
                }
                
                const details = [
                    match.companyName,
                    match.phone,
                    match.email,
                    `${match.street || ''}${match.zip ? ', ' + match.zip : ''}`
                ].filter(Boolean).join('\n');
                
                form.setValue('clientAddress', details);
            }
        }
    }, [watchedCompanyName, contacts, form]);
    
    // Real-time derived financial calculations (item.price is the line item total price)
    let subTotal = 0;
    let vatableSubTotal = 0;
    (watchedItems || []).forEach(item => {
        const price = Number(item?.price) || 0;
        subTotal += price;
        if (item?.vatApplied) {
            vatableSubTotal += price;
        }
    });

    let discountAmount = 0;
    if (watchedDiscountType === 'percentage') {
        discountAmount = subTotal * ((Number(watchedDiscountValue) || 0) / 100);
    } else {
        discountAmount = Number(watchedDiscountValue) || 0;
    }
    discountAmount = Math.min(discountAmount, subTotal);

    const subTotalAfterDiscount = subTotal - discountAmount;
    const discRatio = subTotal > 0 ? subTotalAfterDiscount / subTotal : 1;
    const vatAmount = (vatableSubTotal * discRatio) * 0.20;
    const totalAmount = subTotalAfterDiscount + vatAmount;

    useEffect(() => {
        const tolerance = 0.001;
        if (Math.abs((form.getValues('subTotal') || 0) - subTotal) > tolerance) {
            form.setValue('subTotal', subTotal);
        }
        if (Math.abs((form.getValues('discountAmount') || 0) - discountAmount) > tolerance) {
            form.setValue('discountAmount', discountAmount);
        }
        if (Math.abs((form.getValues('subTotalAfterDiscount') || 0) - subTotalAfterDiscount) > tolerance) {
            form.setValue('subTotalAfterDiscount', subTotalAfterDiscount);
        }
        if (Math.abs((form.getValues('vatAmount') || 0) - vatAmount) > tolerance) {
            form.setValue('vatAmount', vatAmount);
        }
        if (Math.abs((form.getValues('totalAmount') || 0) - totalAmount) > tolerance) {
            form.setValue('totalAmount', totalAmount);
        }
    }, [subTotal, discountAmount, subTotalAfterDiscount, vatAmount, totalAmount, form]);


    const onSubmit = (data: z.infer<typeof CreateInvoiceSchema>) => {
        startTransition(async () => {
            const payload = invoiceToEdit ? { ...data, id: invoiceToEdit.id } : data;
            const result = await saveInvoice(payload);
            if (result.success) {
                onSuccess();
            } else {
                toast({
                    variant: "destructive",
                    title: "Uh oh! Something went wrong.",
                    description: result.message || "Could not save invoice.",
                });
            }
        });
    };

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Modal Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-5 shadow-lg">
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">{invoiceToEdit ? 'Edit Invoice' : 'Create New Invoice'}</h3>
                  <p className="text-xs text-indigo-200">Configure company profile, client information, items, and payment terms.</p>
                </div>
              </div>
            </div>

            {/* Profile & Status Card - Light Emerald Theme */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/40">
                <div className="space-y-2">
                    <Label htmlFor="companyProfileId" className="font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-300">Company Profile</Label>
                    <Controller
                        name="companyProfileId"
                        control={form.control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90 border-emerald-200/80"><SelectValue placeholder="Select Profile" /></SelectTrigger>
                                <SelectContent>
                                    {companyProfiles.map(p => (
                                        <SelectItem key={p.id} value={p.id!}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                     {form.formState.errors.companyProfileId && <p className="text-sm text-destructive font-semibold">{form.formState.errors.companyProfileId.message}</p>}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="status" className="font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-300">Invoice Status</Label>
                    <Controller
                        name="status"
                        control={form.control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="rounded-2xl h-11 font-semibold bg-white/90 dark:bg-slate-900/90 border-emerald-200/80"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Draft">Draft</SelectItem>
                                    <SelectItem value="Sent">Sent</SelectItem>
                                    <SelectItem value="Paid">Paid</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
            </div>

            {/* Client Details Section - Light Blue Theme */}
            <div className="space-y-4 bg-blue-50/40 dark:bg-blue-950/20 p-5 rounded-2xl border border-blue-200/80 dark:border-blue-800/40 shadow-sm">
                <div className="flex items-center gap-2 border-b border-blue-200/60 pb-3 text-blue-950 dark:text-blue-100 font-extrabold text-sm">
                  <User className="h-4 w-4 text-blue-600" />
                  <span>Client Information</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="clientName" className="font-bold text-xs uppercase tracking-wider text-blue-900 dark:text-blue-300">Client Name</Label>
                        <Input 
                            id="clientName" 
                            {...form.register('clientName')} 
                            list="invoice-contacts-list"
                            autoComplete="off"
                            placeholder="Enter client name..."
                            className="rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90 border-blue-200/80"
                        />
                        <datalist id="invoice-contacts-list">
                            {contacts.map(c => <option key={c.id} value={c.name} />)}
                        </datalist>
                        {form.formState.errors.clientName && <p className="text-sm text-destructive font-semibold">{form.formState.errors.clientName.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="companyName" className="font-bold text-xs uppercase tracking-wider text-blue-900 dark:text-blue-300">Company Name</Label>
                        <Input 
                            id="companyName" 
                            {...form.register('companyName')} 
                            list="invoice-companies-list"
                            autoComplete="off"
                            placeholder="Enter company..."
                            className="rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90 border-blue-200/80"
                        />
                        <datalist id="invoice-companies-list">
                            {[...new Set(contacts.map(c => c.companyName).filter(Boolean))].map((comp, idx) => (
                                <option key={idx} value={comp!} />
                            ))}
                        </datalist>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="clientAddress" className="font-bold text-xs uppercase tracking-wider text-blue-900 dark:text-blue-300">Client Details (Address, Phone, Email...)</Label>
                    <Textarea id="clientAddress" {...form.register('clientAddress')} rows={3} placeholder="Manual entry allowed. Will not affect contact list." className="rounded-2xl bg-white/90 dark:bg-slate-900/90 border-blue-200/80"/>
                    {form.formState.errors.clientAddress && <p className="text-sm text-destructive font-semibold">{form.formState.errors.clientAddress.message}</p>}
                </div>
            </div>

            {/* Invoice Dates - Light Blue/Emerald */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-wider text-slate-600">Invoice Date</Label>
                    <Controller
                        name="date"
                        control={form.control}
                        render={({ field }) => (
                            <Popover>
                                <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start font-normal rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90"><CalendarIcon className="mr-2 h-4 w-4 text-indigo-500"/>{field.value ? format(field.value, 'PPP') : "Pick a date"}</Button></PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value as Date} onSelect={field.onChange} /></PopoverContent>
                            </Popover>
                        )}
                    />
                </div>
                <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-wider text-slate-600">Due Date</Label>
                     <Controller
                        name="dueDate"
                        control={form.control}
                        render={({ field }) => (
                            <Popover>
                                <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start font-normal rounded-2xl h-11 bg-white/90 dark:bg-slate-900/90"><CalendarIcon className="mr-2 h-4 w-4 text-purple-500"/>{field.value ? format(field.value, 'PPP') : "Pick a date"}</Button></PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value as Date} onSelect={field.onChange} /></PopoverContent>
                            </Popover>
                        )}
                    />
                </div>
            </div>

            {/* Line Items Card - Light Purple Theme */}
            <div className="space-y-4 bg-purple-50/40 dark:bg-purple-950/20 p-5 rounded-2xl border border-purple-200/80 dark:border-purple-800/40 shadow-sm">
                <div className="flex items-center gap-2 border-b border-purple-200/60 pb-3 text-purple-950 dark:text-purple-100 font-extrabold text-sm">
                  <Package className="h-4 w-4 text-purple-600" />
                  <span>Invoice Line Items</span>
                </div>
                 <div className="grid grid-cols-12 gap-2 items-center bg-purple-100/80 dark:bg-purple-900/50 p-2.5 rounded-xl border border-purple-200/70 text-purple-950 dark:text-purple-200 font-extrabold text-xs uppercase tracking-wider">
                    <div className="col-span-6">Description</div>
                    <div className="col-span-2 text-center">Quantity</div>
                    <div className="col-span-2 text-right">Price (£)</div>
                    <div className="col-span-1 text-center">VAT</div>
                    <div className="col-span-1"></div>
                </div>
                {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-2.5 items-start bg-white/90 dark:bg-slate-900/90 p-3 rounded-2xl border border-purple-200/60 dark:border-purple-800/60 hover:border-purple-400 transition-all duration-200 shadow-sm">
                        <Textarea className="col-span-6 min-h-[42px] rounded-xl text-sm" {...form.register(`items.${index}.description`)} placeholder="Item description"/>
                        <Input className="col-span-2 text-center rounded-xl h-11 font-bold" type="number" {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} placeholder="1"/>
                        <Input className="col-span-2 text-right rounded-xl h-11 font-bold" type="number" step="0.01" {...form.register(`items.${index}.price`, { valueAsNumber: true })} placeholder="0.00"/>
                        <div className="col-span-1 flex items-center justify-center h-11">
                            <Controller
                                control={form.control}
                                name={`items.${index}.vatApplied`}
                                render={({ field: { value, onChange } }) => ( <Checkbox checked={value} onCheckedChange={onChange} className="h-5 w-5 rounded-md"/> )}
                            />
                        </div>
                        <div className="col-span-1 flex items-center justify-center h-11">
                            <Button type="button" variant="destructive" size="icon" onClick={() => fields.length > 1 && remove(index)} disabled={fields.length <= 1} className="rounded-xl h-9 w-9">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
                 <Button type="button" variant="outline" onClick={() => append({ description: '', quantity: 1, price: 0, vatApplied: false })} className="w-full py-3 rounded-2xl border-2 border-dashed border-purple-300 hover:border-purple-600 text-purple-700 bg-purple-50 hover:bg-purple-100 font-extrabold transition-all">
                    <PlusCircle className="mr-2 h-4 w-4 text-purple-600" /> Add Item Line Row
                </Button>
            </div>
            
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="discountValue" className="font-bold text-xs uppercase tracking-wider text-slate-500">Discount</Label>
                    <div className="flex gap-2">
                        <Input id="discountValue" type="number" step="0.01" {...form.register('discountValue', { valueAsNumber: true })} className="rounded-2xl h-11 font-bold bg-white/90 dark:bg-slate-900/90" />
                        <Controller
                            name="discountType"
                            control={form.control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="w-[100px] rounded-2xl h-11 font-bold bg-white/90 dark:bg-slate-900/90"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="amount">£</SelectItem>
                                        <SelectItem value="percentage">%</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="notes" className="font-bold text-xs uppercase tracking-wider text-amber-900 dark:text-amber-300">Notes & Payment Terms</Label>
                    <Textarea id="notes" {...form.register('notes')} className="rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80" rows={3} placeholder="Appears below payment details on the invoice" />
                </div>
            </div>

            {/* Light Vibrant Financial Summary Card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-100/90 via-purple-50/90 to-rose-100/90 dark:from-indigo-950/60 dark:via-purple-950/50 dark:to-rose-950/60 text-slate-900 dark:text-slate-100 p-6 shadow-xl border-2 border-indigo-200 dark:border-indigo-800/80">
                <div className="flex items-center justify-between border-b border-indigo-200/80 dark:border-indigo-800/80 pb-3 mb-4">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300">Invoice Financial Summary</span>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-black">Live Calculation</span>
                </div>

                <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400 font-bold">Subtotal</span><span className="font-extrabold text-slate-900 dark:text-slate-100">£{subTotal.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400 font-bold">Discount</span><span className="font-extrabold text-rose-600 dark:text-rose-400">- £{discountAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400 font-bold">VAT (20%)</span><span className="font-extrabold text-slate-900 dark:text-slate-100">£{vatAmount.toFixed(2)}</span></div>
                    
                    <div className="border-t border-indigo-200/80 dark:border-indigo-800/80 pt-4 mt-3">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200">Grand Total</span>
                        <span className="text-3xl font-black text-indigo-900 dark:text-amber-300 tracking-tight">£{totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                </div>
            </div>
            
            <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button type="button" variant="ghost" onClick={onCancel} className="rounded-2xl font-bold h-11">Cancel</Button>
                <Button type="submit" disabled={isPending} className="rounded-2xl px-8 h-12 font-black text-base bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-90 text-white shadow-xl hover:shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5">
                    {isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    {invoiceToEdit ? 'Save Changes' : 'Create Invoice'}
                </Button>
            </DialogFooter>
        </form>
    );
}
