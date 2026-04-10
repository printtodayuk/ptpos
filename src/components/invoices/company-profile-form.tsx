
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
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
        },
    });

    const onSubmit = (data: z.infer<typeof CreateCompanyProfileSchema>) => {
        startTransition(async () => {
            const payload = companyProfile ? { ...data, id: companyProfile.id } : data;
            const result = await saveCompanyProfile(payload);
            if (result.success) {
                onSuccess();
            } else {
                // You might want to handle errors here, e.g., show a toast
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
                    <Input id="website" placeholder="https://example.com" {...form.register('website')} />
                    {form.formState.errors.website && <p className="text-sm text-destructive">{form.formState.errors.website.message}</p>}
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Contact Email</Label>
                <Input id="email" type="email" {...form.register('email')} />
                 {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="bankDetails">Bank Details</Label>
                <Textarea id="bankDetails" placeholder="Bank Name, Account Number, Sort Code, etc." {...form.register('bankDetails')} />
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

    