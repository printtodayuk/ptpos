'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { MoreHorizontal, Printer } from 'lucide-react';

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
} from '@/components/ui/dropdown-menu';
import type { Transaction } from '@/lib/types';
import { PrintReceipt } from './print-receipt';
import { Badge } from '../ui/badge';

type TransactionsTableProps = {
  transactions: Transaction[];
};

export function TransactionsTable({ transactions }: TransactionsTableProps) {
  const [transactionToPrint, setTransactionToPrint] = useState<Transaction | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleAfterPrint = () => {
      setTransactionToPrint(null);
    };

    if (transactionToPrint) {
      window.addEventListener('afterprint', handleAfterPrint);
      window.print();
    }

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [transactionToPrint]);

  if (transactions.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-10">
        No transactions recorded yet.
      </div>
    );
  }

  return (
    <>
      {isMounted && transactionToPrint && createPortal(
        <div className="print-only">
          <PrintReceipt transaction={transactionToPrint} />
        </div>,
        document.body
      )}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="hidden md:table-cell">Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="hidden lg:table-cell">Operator</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="font-medium">
                  {format(tx.date, 'dd/MM/yyyy')}
                </TableCell>
                <TableCell>{tx.clientName}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline">{tx.paymentMethod}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  £{tx.totalAmount.toFixed(2)}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{tx.operator}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setTransactionToPrint(tx)}>
                        <Printer className="mr-2 h-4 w-4" /> Print Receipt
                      </DropdownMenuItem>
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
