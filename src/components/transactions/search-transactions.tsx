'use client';
import { useState, useTransition, useEffect } from 'react';
import { searchTransactions } from '@/lib/server-actions';
import { TransactionsTable } from '@/components/transactions/transactions-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { useDebounce } from '@/hooks/use-debounce';
import { TransactionForm } from './transaction-form';

type SearchTransactionsProps = {
  type: 'invoicing' | 'non-invoicing';
  onTransactionUpdated: () => void;
};

export function SearchTransactions({ type, onTransactionUpdated }: SearchTransactionsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Transaction[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const performSearch = (term: string) => {
    startSearchTransition(async () => {
      const data = await searchTransactions(term, type);
      setResults(data);
      if(isInitialLoad) setIsInitialLoad(false);
    });
  };

  useEffect(() => {
    // Fetch initial recent transactions on load
    performSearch('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isInitialLoad) {
      performSearch(debouncedSearchTerm);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);


  const handleEdit = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    // Scroll to the top to make the form visible
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleUpdate = () => {
    setTransactionToEdit(null); // Clear the edit state
    onTransactionUpdated(); // Refresh search results
    performSearch(searchTerm); // Re-run search
  }

  return (
    <>
      {transactionToEdit && (
        <div className="mb-6">
          <TransactionForm 
            type={type} 
            onTransactionAdded={handleUpdate} 
            transactionToEdit={transactionToEdit} 
          />
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Search Transactions</CardTitle>
          <CardDescription>Search by TID, client name, or job description.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="e.g. TID0012, John Doe, Flyer Design..."
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
            <TransactionsTable transactions={results} onEdit={handleEdit} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
