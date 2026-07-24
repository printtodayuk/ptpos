
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import { CompanyProfileSchema } from '@/lib/types';
import type { CompanyProfile } from '@/lib/types';
import { saveCompanyProfile } from '@/lib/server-actions-invoices';

type CompanyProfileFormProps = {
    companyProfile?: CompanyProfile | null;
    onSuccess: () => void;
    onCancel: () => void;
};

const CreateCompanyProfileSchema = CompanyProfileSchema.omit({ id: true, createdAt: true });

export function CompanyProfileForm({ companyProfile, onSuccess, onCancel }: CompanyProfileFormProps) {
    const [isPending, startTransition] = useTransition();

    const form = useForm<z.infer<typeof CreateCompanyProfileSchema>>({
        resolver: zodResolver(CreateCompanyProfileSchema),
        defaultValues: {
            name: companyProfile?.name || '',
            logoUrl: companyProfile?.logoUrl || '',
            address: companyProfile?.address || '',
            email: companyProfile?.email || '',
            website: companyProfile?.website || '',
            bankDetails: companyProfile?.bankDetails || '',
            defaultNotes: companyProfile?.defaultNotes || '',
            footerText: companyProfile?.footerText || '',
        },
    });

    const onSubmit = (data: z.infer<typeof CreateCompanyProfileSchema>) => {
        startTransition(async () => {
            const payload = companyProfile ? { ...data, id: companyProfile.id } : data;
            const result = await saveCompanyProfile(payload);
            if (result.success) {
                onSuccess();
            } else {
                console.error(result.message);
            }
        });
    };

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Company Name</Label>
                <Input id="name" {...form.register('name')} />
                {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" {...form.register('address')} />
                {form.formState.errors.address && <p className="text-sm text-destructive">{form.formState.errors.address.message}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="logoUrl">Logo URL</Label>
                    <Input id="logoUrl" placeholder="https://example.com/logo.png" {...form.register('logoUrl')} />
                    {form.formState.errors.logoUrl && <p className="text-sm text-destructive">{form.formState.errors.logoUrl.message}</p>}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input id="website" placeholder="e.g. www.printtoday.co.uk or printtoday.co.uk" {...form.register('website')} />
                    {form.formState.errors.website && <p className="text-sm text-destructive">{form.formState.errors.website.message}</p>}
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Contact Email</Label>
                <Input id="email" type="email" {...form.register('email')} />
                 {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="bankDetails" className="font-bold">Payment Details & Bank Account (Highlighted on Invoice)</Label>
                <Textarea id="bankDetails" placeholder="Bank: HSBC | Account: 12345678 | Sort Code: 40-00-00 | Terms: Payment due within 14 days" rows={3} {...form.register('bankDetails')} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="defaultNotes">Default Notes (Appears below Payment Details on Invoice)</Label>
                <Textarea id="defaultNotes" placeholder="e.g. Thank you for your business! Please quote invoice number on all payments." rows={2} {...form.register('defaultNotes')} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="footerText">Footer Text Line (Appears at the very bottom of Invoice)</Label>
                <Input id="footerText" placeholder="e.g. Print Today POS Ltd • Registered in England & Wales No. 12345678 • VAT Reg No. GB 123 456 789" {...form.register('footerText')} />
            </div>

            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Profile
                </Button>
            </DialogFooter>
        </form>
    );
}

    