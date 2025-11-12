'use client';

import { useEffect, useState, useCallback, useTransition } from 'react';
import { searchTransactions, deleteTransaction } from '@/lib/server-actions';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Search } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { useDebounce } from '@/hooks/use-debounce';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TransactionsTable } from '@/components/transactions/transactions-table';
import { TransactionForm } from '@/components/transactions/transaction-form';
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
import { useToast } from '@/hooks/use-toast';
import { PinLock } from '@/components/admin/pin-lock';


export default function AdminPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Transaction[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { toast } = useToast();
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const performSearch = useCallback(
    (term: string) => {
      startSearchTransition(async () => {
        const allResults = await searchTransactions(term);
        setResults(allResults);
      });
    },
    []
  );

  useEffect(() => {
    performSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, performSearch]);

  const handleEdit = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleDeleteRequest = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
  };
  
  const confirmDelete = async () => {
    if (!transactionToDelete) return;

    setIsDeleting(true);
    const result = await deleteTransaction(transactionToDelete.id!);
    setIsDeleting(false);

    if (result.success) {
      toast({ title: 'Success', description: 'Transaction deleted successfully.' });
      setResults(results.filter(t => t.id !== transactionToDelete.id));
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setTransactionToDelete(null);
  };


  const handleUpdate = () => {
    setTransactionToEdit(null); // Clear the edit state
    performSearch(debouncedSearchTerm); // Re-run search to get fresh data
  };

  const onTransactionChecked = () => {
    performSearch(debouncedSearchTerm);
  }

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

      <div className="flex flex-col gap-6">
          <CardHeader className="p-0">
              <CardTitle>Admin Control Panel</CardTitle>
              <CardDescription>Search, view, edit, and verify all transactions.</CardDescription>
          </CardHeader>
           {transactionToEdit && (
            <div className="mb-6">
              <TransactionForm
                type={transactionToEdit.type}
                onTransactionAdded={handleUpdate}
                transactionToEdit={transactionToEdit}
              />
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Search All Transactions</CardTitle>
              <CardDescription>
                Search by TID, client name, job description, or amount. Leave blank to see recent entries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="e.g. TID0002, John Doe, Flyer Design, 24.50..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              {isSearching ? (
                <div className="flex justify-center items-center p-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <TransactionsTable 
                  transactions={results} 
                  onEdit={handleEdit} 
                  onDelete={handleDeleteRequest}
                  onTransactionChecked={onTransactionChecked}
                  showAdminControls={true}
                />
              )}
            </CardContent>
          </Card>
      </div>
    </PinLock>
  );
}
