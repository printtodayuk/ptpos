'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { getContacts } from '@/lib/server-actions-contacts';
import type { Contact } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Copy, Check, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useDebounce } from '@/hooks/use-debounce';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function ContactList() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

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
      contact.name,
      contact.phone,
      contact.email,
      addressParts || '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(textToCopy);
    setCopiedId(contact.id!);
    setTimeout(() => setCopiedId(null), 2000);
  };
  
  const filteredContacts = useMemo(() => {
    if (!debouncedSearchTerm) {
      return contacts;
    }
    const lowercasedTerm = debouncedSearchTerm.toLowerCase();
    return contacts.filter(contact => 
      contact.name.toLowerCase().includes(lowercasedTerm) ||
      contact.phone.toLowerCase().includes(lowercasedTerm)
    );
  }, [contacts, debouncedSearchTerm]);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
            <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                type="text"
                placeholder="Search by name or phone number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10"
                />
            </div>
        </div>

        {isLoading ? (
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
                  <TableHead>Name</TableHead>
                  <TableHead>Phone / Email</TableHead>
                  <TableHead className="hidden md:table-cell">Address</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Submitted On</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>
                      <div>{contact.phone}</div>
                      <div className="text-muted-foreground text-xs">{contact.email}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {[contact.street, contact.city, contact.state, contact.zip].filter(Boolean).join(', ') || 'N/A'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right">
                      {contact.createdAt && format(new Date(contact.createdAt), 'dd/MM/yyyy p')}
                    </TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
