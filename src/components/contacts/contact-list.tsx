
'use client';

import { useEffect, useState, useTransition, useMemo, useCallback } from 'react';
import { getContacts, updateContact, deleteContact } from '@/lib/server-actions-contacts';
import type { Contact } from '@/lib/types';
import { ContactSchema } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Copy, Check, Search, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useDebounce } from '@/hooks/use-debounce';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

export function ContactList() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const { toast } = useToast();

  const fetchContacts = useCallback(() => {
    startLoadingTransition(async () => {
      const data = await getContacts();
      setContacts(data);
    });
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleCopy = (contact: Contact) => {
    const addressParts = [
        contact.street,
        contact.city,
        contact.state,
        contact.zip
    ].filter(Boolean).join(', ');

    const textToCopy = [
      contact.companyName,
      contact.name,
      contact.phone,
      contact.email,
      addressParts || '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(textToCopy);
    setCopiedId(contact.id!);
    setTimeout(() => setCopiedId(null), 2000);
  };
  
  const handleDelete = async () => {
    if (!contactToDelete?.id) return;
    setIsDeleting(true);
    const result = await deleteContact(contactToDelete.id);
    setIsDeleting(false);
    if (result.success) {
      toast({ title: 'Success', description: result.message });
      fetchContacts();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setContactToDelete(null);
  };

  const filteredContacts = useMemo(() => {
    if (!debouncedSearchTerm) {
      return contacts;
    }
    const lowercasedTerm = debouncedSearchTerm.toLowerCase();
    return contacts.filter(contact => 
      (contact.name && contact.name.toLowerCase().includes(lowercasedTerm)) ||
      (contact.companyName && contact.companyName.toLowerCase().includes(lowercasedTerm)) ||
      (contact.phone && contact.phone.toLowerCase().includes(lowercasedTerm)) ||
      (contact.email && contact.email.toLowerCase().includes(lowercasedTerm))
    );
  }, [contacts, debouncedSearchTerm]);

  return (
    <>
      <EditContactDialog 
        contact={contactToEdit} 
        isOpen={!!contactToEdit} 
        onClose={() => setContactToEdit(null)} 
        onSuccess={() => {
            setContactToEdit(null);
            fetchContacts();
        }}
      />

      <AlertDialog open={!!contactToDelete} onOpenChange={(open) => !open && setContactToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the contact for <span className="font-bold">{contactToDelete?.companyName}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
              <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                  type="text"
                  placeholder="Search by company, name, phone or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10"
                  />
              </div>
          </div>

          {isLoading && contacts.length === 0 ? (
            <div className="flex justify-center items-center p-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center text-muted-foreground p-10">
              {searchTerm ? 'No contacts match your search.' : 'No contacts have been submitted yet.'}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company / Name</TableHead>
                    <TableHead>Phone / Email</TableHead>
                    <TableHead className="hidden md:table-cell">Address</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Submitted On</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                          <div className="font-bold">{contact.companyName || 'N/A'}</div>
                          {contact.name && <div className="text-xs text-muted-foreground">{contact.name}</div>}
                      </TableCell>
                      <TableCell>
                        <div>{contact.phone || <span className="text-muted-foreground italic text-xs">No phone</span>}</div>
                        <div className="text-muted-foreground text-xs">{contact.email || <span className="italic">No email</span>}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {[contact.street, contact.city, contact.state, contact.zip].filter(Boolean).join(', ') || 'N/A'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right">
                        {contact.createdAt && format(new Date(contact.createdAt), 'dd/MM/yyyy p')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setContactToEdit(contact)}
                            >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopy(contact)}
                            >
                                {copiedId === contact.id ? (
                                <Check className="mr-2 h-4 w-4 text-green-500" />
                                ) : (
                                <Copy className="mr-2 h-4 w-4" />
                                )}
                                Copy
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setContactToDelete(contact)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function EditContactDialog({ contact, isOpen, onClose, onSuccess }: { contact: Contact | null, isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof ContactSchema>>({
        resolver: zodResolver(ContactSchema),
    });

    useEffect(() => {
        if (contact) {
            form.reset({
                ...contact,
                companyName: contact.companyName || '',
                name: contact.name || '',
                email: contact.email || '',
                phone: contact.phone || '',
                street: contact.street || '',
                city: contact.city || '',
                state: contact.state || '',
                zip: contact.zip || '',
            });
        }
    }, [contact, form]);

    const onSubmit = (data: z.infer<typeof ContactSchema>) => {
        if (!contact?.id) return;
        startTransition(async () => {
            const result = await updateContact(contact.id!, data);
            if (result.success) {
                toast({ title: 'Success', description: 'Contact updated.' });
                onSuccess();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        });
    };

    if (!contact) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Edit Contact: {contact.companyName || 'Unknown'}</DialogTitle>
                    <DialogDescription>Update the customer's information below.</DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="companyName">Company Name *</Label>
                            <Input id="companyName" {...form.register('companyName')} />
                            {form.formState.errors.companyName && <p className="text-sm text-destructive">{form.formState.errors.companyName.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" {...form.register('name')} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input id="email" type="email" {...form.register('email')} />
                            {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input id="phone" {...form.register('phone')} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="street">Street Address</Label>
                        <Input id="street" {...form.register('street')} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <Input id="city" {...form.register('city')} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="state">State</Label>
                            <Input id="state" {...form.register('state')} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="zip">ZIP Code</Label>
                            <Input id="zip" {...form.register('zip')} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>Cancel</Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
