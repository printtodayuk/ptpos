'use client';

import { useEffect, useTransition } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, format } from 'date-fns';
import { Loader2, PlusCircle, Trash2, Calendar as CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { InvoiceSchema } from '@/lib/types';
import type { CompanyProfile, Invoice } from '@/lib/types';
import { saveInvoice } from '@/lib/server-actions-invoices';

const CreateInvoiceSchema = InvoiceSchema.omit({ id: true, invoiceId: true, createdAt: true });

type InvoiceFormProps = {
    companyProfiles: CompanyProfile[];
    invoiceToEdit?: Invoice | null;
    onSuccess: () => void;
    onCancel: () => void;
};

export function InvoiceForm({ companyProfiles, invoiceToEdit, onSuccess, onCancel }: InvoiceFormProps) {
    const [isPending, startTransition] = useTransition();

    const form = useForm<z.infer<typeof CreateInvoiceSchema>>({
        resolver: zodResolver(CreateInvoiceSchema),
        defaultValues: invoiceToEdit ? {
            ...invoiceToEdit,
            date: new Date(invoiceToEdit.date),
            dueDate: new Date(invoiceToEdit.dueDate),
        } : {
            companyProfileId: companyProfiles[0]?.id || '',
            clientName: '',
            clientAddress: '',
            date: new Date(),
            dueDate: addDays(new Date(), 30),
            items: [{ description: '', quantity: 1, price: 0, vatApplied: false }],
            subTotal: 0,
            discountType: 'amount',
            discountValue: 0,
            discountAmount: 0,
            subTotalAfterDiscount: 0,
            vatAmount: 0,
            totalAmount: 0,
            notes: '',
            status: 'Draft',
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'items',
    });

    const watchedItems = form.watch('items');
    const watchedDiscountType = form.watch('discountType');
    const watchedDiscountValue = form.watch('discountValue');
    
    useEffect(() => {
        const subTotal = watchedItems.reduce((acc, item) => {
            return acc + (item.price || 0);
        }, 0);

        let discountAmount = 0;
        if (watchedDiscountType === 'percentage') {
            discountAmount = subTotal * ((watchedDiscountValue || 0) / 100);
        } else {
            discountAmount = watchedDiscountValue || 0;
        }
        
        const subTotalAfterDiscount = subTotal - discountAmount;
        
        const vatAmount = watchedItems.reduce((acc, item) => {
            if (item.vatApplied) {
                const itemPrice = item.price || 0;
                // Distribute discount proportionally before calculating VAT
                const itemProportion = subTotal > 0 ? itemPrice / subTotal : 0;
                const itemDiscount = discountAmount * itemProportion;
                const itemPriceAfterDiscount = itemPrice - itemDiscount;
                return acc + (itemPriceAfterDiscount * 0.20);
            }
            return acc;
        }, 0);

        const totalAmount = subTotalAfterDiscount + vatAmount;

        form.setValue('subTotal', subTotal);
        form.setValue('discountAmount', discountAmount);
        form.setValue('subTotalAfterDiscount', subTotalAfterDiscount);
        form.setValue('vatAmount', vatAmount);
        form.setValue('totalAmount', totalAmount);

    }, [watchedItems, watchedDiscountType, watchedDiscountValue, form.setValue]);


    const onSubmit = (data: z.infer<typeof CreateInvoiceSchema>) => {
        startTransition(async () => {
            const payload = invoiceToEdit ? { ...data, id: invoiceToEdit.id } : data;
            const result = await saveInvoice(payload);
            if (result.success) {
                onSuccess();
            } else {
                console.error("Failed to save invoice", result.errors);
            }
        });
    };

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="companyProfileId">Your Company</Label>
                    <Controller
                        name="companyProfileId"
                        control={form.control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Select a company" /></SelectTrigger>
                                <SelectContent>
                                    {companyProfiles.map(p => <SelectItem key={p.id} value={p.id!}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    />
                     {form.formState.errors.companyProfileId && <p className="text-sm text-destructive">{form.formState.errors.companyProfileId.message}</p>}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Controller
                        name="status"
                        control={form.control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
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

            <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input id="clientName" {...form.register('clientName')} />
                {form.formState.errors.clientName && <p className="text-sm text-destructive">{form.formState.errors.clientName.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="clientAddress">Client Address</Label>
                <Textarea id="clientAddress" {...form.register('clientAddress')} />
                {form.formState.errors.clientAddress && <p className="text-sm text-destructive">{form.formState.errors.clientAddress.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Invoice Date</Label>
                    <Controller
                        name="date"
                        control={form.control}
                        render={({ field }) => (
                            <Popover>
                                <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start font-normal"><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, 'PPP') : "Pick a date"}</Button></PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value as Date} onSelect={field.onChange} /></PopoverContent>
                            </Popover>
                        )}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Due Date</Label>
                     <Controller
                        name="dueDate"
                        control={form.control}
                        render={({ field }) => (
                            <Popover>
                                <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start font-normal"><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, 'PPP') : "Pick a date"}</Button></PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value as Date} onSelect={field.onChange} /></PopoverContent>
                            </Popover>
                        )}
                    />
                </div>
            </div>

            <div className="space-y-4">
                <Label>Invoice Items</Label>
                 <div className="grid grid-cols-12 gap-2 items-center border-b pb-2">
                    <div className="col-span-6"><Label className="text-xs">Description</Label></div>
                    <div className="col-span-2"><Label className="text-xs">Quantity</Label></div>
                    <div className="col-span-2"><Label className="text-xs">Total Price (£)</Label></div>
                    <div className="col-span-1 text-center"><Label className="text-xs">VAT</Label></div>
                </div>
                {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                        <Textarea className="col-span-6" {...form.register(`items.${index}.description`)} placeholder="Item description"/>
                        <Input className="col-span-2" type="number" {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} placeholder="1"/>
                        <Input className="col-span-2" type="number" step="0.01" {...form.register(`items.${index}.price`, { valueAsNumber: true })} placeholder="0.00"/>
                        <div className="col-span-1 flex items-center justify-center h-full">
                            <Controller
                                control={form.control}
                                name={`items.${index}.vatApplied`}
                                render={({ field: { value, onChange } }) => ( <Checkbox checked={value} onCheckedChange={onChange}/> )}
                            />
                        </div>
                        <Button type="button" variant="destructive" size="icon" onClick={() => fields.length > 1 && remove(index)} disabled={fields.length <= 1} className="col-span-1">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                 <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, price: 0, vatApplied: false })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                </Button>
            </div>
            
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="discountValue">Discount</Label>
                    <div className="flex gap-2">
                        <Input id="discountValue" type="number" step="0.01" {...form.register('discountValue', { valueAsNumber: true })} />
                        <Controller
                            name="discountType"
                            control={form.control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
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
                    <Label htmlFor="notes">Notes / Payment Terms</Label>
                    <Textarea id="notes" {...form.register('notes')} />
                </div>
            </div>

            <div className="border rounded-lg p-4 space-y-2 bg-muted/50">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal:</span><span>£{form.getValues('subTotal')?.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount:</span><span>- £{form.getValues('discountAmount')?.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT (20%):</span><span>£{form.getValues('vatAmount')?.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-lg"><span className="text-foreground">Total:</span><span>£{form.getValues('totalAmount')?.toFixed(2)}</span></div>
            </div>
            
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {invoiceToEdit ? 'Save Changes' : 'Create Invoice'}
                </Button>
            </DialogFooter>
        </form>
    );
}
