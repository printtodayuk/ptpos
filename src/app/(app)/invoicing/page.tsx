'use client';
import { useState, useEffect, useCallback, useTransition } from 'react';
import { getTransactions } from "@/lib/server-actions";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Transaction } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function InvoicingPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const fetchTransactions = useCallback(() => {
    startTransition(() => {
      setIsLoading(true);
      getTransactions('invoicing').then((data) => {
        setTransactions(data);
        setIsLoading(false);
      });
    });
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);


  return (
    <div className="flex flex-col gap-6">
      <TransactionForm type="invoicing" onTransactionAdded={fetchTransactions} />
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
          <CardDescription>A list of the most recent invoicing transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <TransactionsTable transactions={transactions} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
