
'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Printer, CheckCircle, Trash2, Loader2, Ban, Edit } from 'lucide-react';

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
import { Checkbox } from '@/components/ui/checkbox';
import type { Transaction } from '@/lib/types';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { markTransactionAsChecked } from '@/lib/server-actions';
import { ReceiptDialog } from './receipt-dialog';
import { SimplePagination } from '../ui/pagination';

const ROWS_PER_PAGE = 10;

type TransactionsTableProps = {
  transactions: Transaction[];
  onDelete?: (transaction: Transaction) => void;
  onEdit?: (transaction: Transaction) => void;
  onTransactionChecked?: () => void;
  showAdminControls?: boolean;
  selectable?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
};

export function TransactionsTable({ 
  transactions, 
  onDelete,
  onEdit,
  onTransactionChecked, 
  showAdminControls = false,
  selectable = false,
  onSelectionChange 
}: TransactionsTableProps) {
  const [transactionToView, setTransactionToView] = useState<Transaction | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  
  const totalPages = Math.ceil(transactions.length / ROWS_PER_PAGE);

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return transactions.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [transactions, currentPage]);


  useEffect(() => {
    onSelectionChange?.(selectedRows);
  }, [selectedRows, onSelectionChange]);
  
  useEffect(() => {
    setSelectedRows([]);
    setCurrentPage(1);
  }, [transactions]);


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

  const handleSelectRow = (id: string) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };
  
  const handleSelectAll = () => {
    if (selectedRows.length === transactions.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(transactions.map(t => t.id!));
    }
  };
  
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-10">
        No transactions found.
      </div>
    );
  }

  const isAllSelected = selectedRows.length === transactions.length && transactions.length > 0;

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
              {selectable && (
                 <TableHead padding="checkbox">
                    <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                    />
                </TableHead>
              )}
              <TableHead>TID</TableHead>
              {showAdminControls && <TableHead>Type</TableHead>}
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="hidden md:table-cell">Invoice #</TableHead>
              <TableHead className="hidden md:table-cell">JID</TableHead>
              <TableHead className="hidden xl:table-cell">Job Description</TableHead>
              <TableHead className="hidden lg:table-cell">Reference</TableHead>
              <TableHead className="hidden md:table-cell">Payment</TableHead>
              <TableHead className="text-right">Paid Amount</TableHead>
              <TableHead className="hidden lg:table-cell">Operator</TableHead>
              <TableHead className="hidden lg:table-cell text-center">Admin Checked</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTransactions.map((tx) => (
              <TableRow key={tx.id} data-state={selectedRows.includes(tx.id!) ? "selected" : ""}>
                 {selectable && (
                    <TableCell padding="checkbox">
                        <Checkbox
                            checked={selectedRows.includes(tx.id!)}
                            onCheckedChange={() => handleSelectRow(tx.id!)}
                            aria-label="Select row"
                        />
                    </TableCell>
                )}
                <TableCell>
                  <Badge variant="secondary">{tx.transactionId}</Badge>
                </TableCell>
                {showAdminControls && (
                  <TableCell>
                    <Badge variant={tx.type === 'invoicing' ? 'default' : 'secondary'}>
                      {tx.type === 'invoicing' ? 'Xero' : 'PT Till'}
                    </Badge>
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  {format(new Date(tx.date), 'dd/MM/yy')}
                </TableCell>
                <TableCell>{tx.clientName}</TableCell>
                <TableCell className="hidden md:table-cell">{tx.invoiceNumber}</TableCell>
                <TableCell className="hidden md:table-cell">{tx.jid}</TableCell>
                <TableCell className="hidden xl:table-cell truncate max-w-xs">{tx.jobDescription}</TableCell>
                <TableCell className="hidden lg:table-cell">{tx.reference}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline">{tx.paymentMethod}</Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  £{tx.paidAmount.toFixed(2)}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{tx.operator}</TableCell>
                 <TableCell className="hidden lg:table-cell text-center">
                      <Badge variant={tx.adminChecked ? 'default' : 'destructive'} className={cn(tx.adminChecked && 'bg-green-600 hover:bg-green-600/80')}>
                          {tx.adminChecked ? <CheckCircle className="mr-1 h-3 w-3"/> : <Ban className="mr-1 h-3 w-3"/>}
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
                      {showAdminControls && (
                        <>
                          <DropdownMenuItem onSelect={() => onEdit?.(tx)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
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
      <SimplePagination 
        currentPage={currentPage} 
        totalPages={totalPages} 
        onPageChange={handlePageChange} 
      />
    </>
  );
}
