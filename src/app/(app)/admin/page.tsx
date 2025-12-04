
'use client';

import { useEffect, useState, useCallback, useTransition } from 'react';
import { searchTransactions, deleteTransaction, bulkDeleteTransactions, bulkMarkAsChecked } from '@/lib/server-actions';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Search, Trash2, CheckCircle, Edit, Filter } from 'lucide-react';
import type { Transaction, PaymentMethod } from '@/lib/types';
import { paymentMethods } from '@/lib/types';
import { useDebounce } from '@/hooks/use-debounce';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TransactionsTable } from '@/components/transactions/transactions-table';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { PinLock } from '@/components/admin/pin-lock';
import { EditTransactionDialog } from '@/components/transactions/edit-transaction-dialog';

const filterablePaymentMethods: ('All' | PaymentMethod)[] = ['All', ...paymentMethods];

export default function AdminPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'All' | PaymentMethod>('All');
  const [results, setResults] = useState<Transaction[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [isBulkActionPending, startBulkActionTransition] = useTransition();
  const [bulkAction, setBulkAction] = useState<'delete' | 'check' | null>(null);

  const { toast } = useToast();
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const performSearch = useCallback((term: string, payment: 'All' | PaymentMethod) => {
    startSearchTransition(async () => {
      const allResults = await searchTransactions(term, payment === 'All' ? undefined : payment);
      setResults(allResults);
      setSelectedTransactions([]); // Clear selection on new search
    });
  }, []);

  useEffect(() => {
    performSearch(debouncedSearchTerm, paymentFilter);
  }, [debouncedSearchTerm, paymentFilter, performSearch]);

  const handleDeleteRequest = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
  };
  
  const handleEditRequest = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;

    setIsDeleting(true);
    const result = await deleteTransaction(transactionToDelete.id!);
    setIsDeleting(false);

    if (result.success) {
      toast({ title: 'Success', description: 'Transaction deleted successfully.' });
      performSearch(debouncedSearchTerm, paymentFilter);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setTransactionToDelete(null);
  };

  const onTransactionChecked = () => {
    performSearch(debouncedSearchTerm, paymentFilter);
  };
  
  const handleUpdateSuccess = () => {
    setTransactionToEdit(null);
    performSearch(debouncedSearchTerm, paymentFilter);
  };

  const handleSelectionChange = (ids: string[]) => {
    setSelectedTransactions(ids);
  };
  
  const handleBulkDelete = () => {
    if (selectedTransactions.length === 0) return;
    setBulkAction('delete');
  };

  const handleBulkCheck = () => {
    if (selectedTransactions.length === 0) return;
    setBulkAction('check');
  };

  const confirmBulkAction = () => {
    if (!bulkAction) return;

    startBulkActionTransition(async () => {
        let result;
        if (bulkAction === 'delete') {
            result = await bulkDeleteTransactions(selectedTransactions);
        } else if (bulkAction === 'check') {
            result = await bulkMarkAsChecked(selectedTransactions);
        }

        if (result?.success) {
            toast({ title: 'Success', description: result.message });
            performSearch(debouncedSearchTerm, paymentFilter);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result?.message || 'An error occurred.' });
        }
        setBulkAction(null);
        setSelectedTransactions([]);
    });
  };

  return (
    <PinLock>
      <AlertDialog open={!!transactionToDelete} onOpenChange={() => setTransactionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the transaction
              with ID <span className="font-bold">{transactionToDelete?.transactionId}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditTransactionDialog
        transaction={transactionToEdit}
        isOpen={!!transactionToEdit}
        onClose={() => setTransactionToEdit(null)}
        onSuccess={handleUpdateSuccess}
      />
      
      <AlertDialog open={!!bulkAction} onOpenChange={() => setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {bulkAction} {selectedTransactions.length} selected transaction(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkAction} disabled={isBulkActionPending}>
              {isBulkActionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-6">
        <CardHeader className="p-0">
          <CardTitle>Admin Control Panel</CardTitle>
          <CardDescription>Search, view, and verify all transactions.</CardDescription>
        </CardHeader>

        <Card>
          <CardHeader>
             <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <CardTitle>Search Transactions</CardTitle>
                    <CardDescription className="mt-1">
                        Search by ID, client, or description. Leave blank to see all.
                    </CardDescription>
                </div>
                 {selectedTransactions.length > 0 && (
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                        Bulk Actions ({selectedTransactions.length})
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={handleBulkCheck} className="text-green-600 focus:text-green-700">
                            <CheckCircle className="mr-2 h-4 w-4" /> Mark as Checked
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={handleBulkDelete} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="e.g. TID0002, John Doe, Flyer Design..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto">
                        <Filter className="mr-2 h-4 w-4" />
                        <span>Filter by: {paymentFilter}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Payment Method</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={paymentFilter} onValueChange={(value) => setPaymentFilter(value as 'All' | PaymentMethod)}>
                        {filterablePaymentMethods.map((method) => (
                            <DropdownMenuRadioItem key={method} value={method}>
                                {method}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-4">
              {isSearching ? (
                <div className="flex justify-center items-center p-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <TransactionsTable
                  transactions={results}
                  onDelete={handleDeleteRequest}
                  onEdit={handleEditRequest}
                  onTransactionChecked={onTransactionChecked}
                  showAdminControls={true}
                  selectable={true}
                  onSelectionChange={handleSelectionChange}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PinLock>
  );
}
