'use client';

import { useEffect, useState, useTransition } from 'react';
import { getContacts } from '@/lib/server-actions-contacts';
import type { Contact } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';

export function ContactList() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    startLoadingTransition(async () => {
      const data = await getContacts();
      setContacts(data);
    });
  }, []);

  const handleCopy = (contact: Contact) => {
    const addressParts = [
        contact.street,
        contact.city,
        contact.state,
        contact.zip
    ].filter(Boolean).join(', ');

    const textToCopy = [
      `Name: ${contact.name}`,
      `Phone: ${contact.phone}`,
      `Email: ${contact.email}`,
      `Address: ${addressParts || 'N/A'}`,
    ].join('\n');

    navigator.clipboard.writeText(textToCopy);
    setCopiedId(contact.id!);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-10">
        No contacts have been submitted yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {contacts.map((contact) => (
        <Card key={contact.id}>
          <CardHeader>
            <CardTitle>{contact.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>Phone:</strong> {contact.phone}</p>
            <p><strong>Email:</strong> {contact.email}</p>
            <p>
                <strong>Address:</strong> 
                {' '}{[contact.street, contact.city, contact.state, contact.zip].filter(Boolean).join(', ') || 'N/A'}
            </p>
            {contact.createdAt && (
                <p className="text-xs text-muted-foreground pt-2">
                    Submitted on: {format(new Date(contact.createdAt), 'PPP p')}
                </p>
            )}
          </CardContent>
          <CardFooter>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => handleCopy(contact)}
            >
              {copiedId === contact.id ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Details
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
