'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ContactSchema } from '@/lib/types';
import { addContact } from '@/lib/server-actions-contacts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ContactFormValues = z.infer<typeof ContactSchema>;

export function ContactForm() {
  const [isPending, startTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(ContactSchema.omit({ id: true, createdAt: true })),
    defaultValues: {
      name: '',
      companyName: '',
      street: '',
      city: '',
      state: '',
      zip: '',
      phone: '',
      email: '',
    },
  });

  const onSubmit = (data: ContactFormValues) => {
    startTransition(async () => {
      const result = await addContact(data);
      if (result.success) {
        toast({
          title: 'Success!',
          description: "We've received your information.",
        });
        setIsSuccess(true);
        form.reset();
      } else {
        toast({
          variant: 'destructive',
          title: 'Uh oh!',
          description: result.message || 'Something went wrong.',
        });
      }
    });
  };

  if (isSuccess) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold">Thank You!</h3>
        <p className="text-muted-foreground mt-2">Your information has been submitted successfully.</p>
         <Button onClick={() => setIsSuccess(false)} className="mt-6">Submit Another</Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" {...form.register('name')} />
                {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
            </div>
             <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input id="companyName" {...form.register('companyName')} />
             </div>
       </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" {...form.register('email')} />
            {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
        </div>
        <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" {...form.register('phone')} />
            {form.formState.errors.phone && <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>}
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="street">Street Address</Label>
        <Input id="street" {...form.register('street')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" {...form.register('city')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State / Province</Label>
          <Input id="state" {...form.register('state')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">ZIP / Postal Code</Label>
          <Input id="zip" {...form.register('zip')} />
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Details
      </Button>
    </form>
  );
}

    