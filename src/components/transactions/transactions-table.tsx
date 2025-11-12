'use client';

import { useState, useEffect, useTransition } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Printer, CheckCircle, Edit, Trash2, Loader2, Ban } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { Transaction } from '@/lib/types';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { markTransactionAsChecked } from '@/lib/server-actions';
import { ReceiptDialog } from './receipt-dialog';

type TransactionsTableProps = {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  onTransactionChecked?: () => void;
  showAdminControls?: boolean;
};

export function TransactionsTable({ transactions, onEdit, onDelete, onTransactionChecked, showAdminControls = false }: TransactionsTableProps) {
  const [transactionToView, setTransactionToView] = useState<Transaction | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const handleCheck = (id: string) => {
    startTransition(async () => {
      const result = await markTransactionAsChecked(id);
      if (result.success) {
        toast({ title: 'Success', description: result.message });
        onTransactionChecked?.();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.message,
        });
      }
    });
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-10">
        No transactions found.
      </div>
    );
  }

  return (
    <>
      <ReceiptDialog 
        transaction={transactionToView}
        isOpen={!!transactionToView}
        onClose={() => setTransactionToView(null)}
      />
      <div className="rounded-lg border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>TID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="hidden md:table-cell">Reference</TableHead>
              <TableHead className="hidden md:table-cell">Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="hidden lg:table-cell">Operator</TableHead>
              <TableHead className="hidden lg:table-cell text-center">Admin Checked</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>
                  <Badge variant="secondary">{tx.transactionId}</Badge>
                </TableCell>
                <TableCell><Badge variant={tx.type === 'invoicing' ? 'default' : 'secondary'}>{tx.type}</Badge></TableCell>
                <TableCell className="font-medium">
                  {format(new Date(tx.date), 'dd/MM/yyyy')}
                </TableCell>
                <TableCell>{tx.clientName}</TableCell>
                <TableCell className="hidden md:table-cell">{tx.reference}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline">{tx.paymentMethod}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  £{tx.totalAmount.toFixed(2)}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{tx.operator}</TableCell>
                <TableCell className="hidden lg:table-cell text-center">
                    <Badge variant={tx.adminChecked ? 'default' : 'destructive'} className={cn(tx.adminChecked && 'bg-green-600 hover:bg-green-600/80')}>
                        <CheckCircle className="mr-1 h-3 w-3"/>
                        {tx.adminChecked ? 'Yes' : 'No'}
                    </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setTransactionToView(tx)}>
                        <Printer className="mr-2 h-4 w-4" /> View Receipt
                      </DropdownMenuItem>
                      {onEdit && (
                        <DropdownMenuItem onSelect={() => onEdit(tx)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                      )}
                      {showAdminControls && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => handleCheck(tx.id!)} disabled={isPending || tx.adminChecked}>
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : tx.adminChecked ? <Ban className="mr-2 h-4 w-4" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            Mark as Checked
                          </DropdownMenuItem>
                          {onDelete && (
                            <DropdownMenuItem onSelect={() => onDelete(tx)} className="text-destructive focus:text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
