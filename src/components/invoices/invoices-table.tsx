
'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Eye, Edit, Trash2, CheckCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Invoice, CompanyProfile, InvoiceStatus } from '@/lib/types';
import { setInvoiceStatus } from '@/lib/server-actions-invoices';
import { useToast } from '@/hooks/use-toast';

type InvoicesTableProps = {
  invoices: Invoice[];
  companyProfiles: CompanyProfile[];
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onView: (invoice: Invoice) => void;
  onStatusChange: () => void;
};

export function InvoicesTable({ invoices, companyProfiles, onEdit, onDelete, onView, onStatusChange }: InvoicesTableProps) {
  const { toast } = useToast();
  const [isUpdating, startUpdateTransition] = useTransition();

  const getProfileName = (profileId: string) => {
    return companyProfiles.find(p => p.id === profileId)?.name || 'Unknown';
  };

  const handleSetPaid = (id: string) => {
    startUpdateTransition(async () => {
        const result = await setInvoiceStatus(id, 'Paid');
        if (result.success) {
            toast({ title: "Success", description: "Invoice marked as paid." });
            onStatusChange();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
    });
  };

  const getStatusClass = (status: InvoiceStatus) => {
      switch(status) {
          case 'Paid': return 'bg-green-600 text-white';
          case 'Sent': return 'bg-blue-500 text-white';
          case 'Draft':
          default: return 'bg-gray-500 text-white';
      }
  };

  if (invoices.length === 0) {
    return <div className="text-center text-muted-foreground p-10">No invoices created yet.</div>;
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice ID</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="font-medium">{invoice.invoiceId}</TableCell>
              <TableCell>{invoice.clientName}</TableCell>
              <TableCell>{getProfileName(invoice.companyProfileId)}</TableCell>
              <TableCell>{format(new Date(invoice.date), 'dd/MM/yyyy')}</TableCell>
              <TableCell><Badge className={cn('border-transparent', getStatusClass(invoice.status))}>{invoice.status}</Badge></TableCell>
              <TableCell className="text-right font-bold">£{invoice.totalAmount.toFixed(2)}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onView(invoice)}><Eye className="mr-2 h-4 w-4" />View</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onEdit(invoice)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                    {invoice.status !== 'Paid' && (
                        <DropdownMenuItem onSelect={() => handleSetPaid(invoice.id!)} disabled={isUpdating}><CheckCircle className="mr-2 h-4 w-4" />Mark as Paid</DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => onDelete(invoice)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

    