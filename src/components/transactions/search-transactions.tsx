'use client';
import { useState, useTransition, useEffect, useMemo } from 'react';
import { searchTransactions } from '@/lib/server-actions';
import { TransactionsTable } from '@/components/transactions/transactions-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 200);

  const fetchInitialData = () => {
    startSearchTransition(async () => {
      const data = await searchTransactions(type);
      setAllTransactions(data);
    });
  };

  useEffect(() => {
    fetchInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const filteredResults = useMemo(() => {
    if (!debouncedSearchTerm) {
      return allTransactions;
    }
    const lowercasedTerm = debouncedSearchTerm.toLowerCase();
    return allTransactions.filter(t => {
        const tidMatch = t.transactionId?.toLowerCase().includes(lowercasedTerm);
        const clientMatch = t.clientName?.toLowerCase().includes(lowercasedTerm);
        const jobMatch = t.jobDescription?.toLowerCase().includes(lowercasedTerm);
        return tidMatch || clientMatch || jobMatch;
    });
  }, [debouncedSearchTerm, allTransactions]);


  const handleEdit = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleUpdate = () => {
    setTransactionToEdit(null); // Clear the edit state
    onTransactionUpdated(); // Notify parent to re-render (and thus re-fetch)
    fetchInitialData(); // Re-fetch all data
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
          <CardTitle>Search Recent Transactions</CardTitle>
          <CardDescription>Search the last 50 transactions by TID, client name, or job description.</CardDescription>
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
          {isSearching && allTransactions.length === 0 ? (
            <div className="flex justify-center items-center p-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <TransactionsTable transactions={filteredResults} onEdit={handleEdit} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
