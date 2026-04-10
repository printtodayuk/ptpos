
'use client';
import { useState, useTransition, useEffect, useCallback } from 'react';
import { searchTransactions } from '@/lib/server-actions';
import { TransactionsTable } from '@/components/transactions/transactions-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { useDebounce } from '@/hooks/use-debounce';

type SearchTransactionsProps = {
  type: 'invoicing' | 'non-invoicing';
  onTransactionUpdated: () => void;
};

export function SearchTransactions({ type, onTransactionUpdated }: SearchTransactionsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Transaction[]>([]);
  const [isSearching, startSearchTransition] = useTransition();

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const performSearch = useCallback(
    (term: string) => {
      startSearchTransition(async () => {
        const allResults = await searchTransactions(term);
        setResults(allResults.filter(t => t.type === type));
      });
    },
    [type]
  );

  useEffect(() => {
    performSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, performSearch]);


  const onTransactionChecked = () => {
    performSearch(debouncedSearchTerm);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Search Transactions</CardTitle>
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
              onTransactionChecked={onTransactionChecked}
              showAdminControls={false}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
