'use client';

import { useEffect, useState, useCallback, useTransition } from 'react';
import { getPendingTransactions } from '@/lib/server-actions';
import { AdminClient } from '@/components/admin/admin-client';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import type { Transaction } from '@/lib/types';


export default function AdminPage() {
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const fetchPendingTransactions = useCallback(() => {
    setIsLoading(true);
    getPendingTransactions().then((data) => {
      setPendingTransactions(data);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchPendingTransactions();
  }, [fetchPendingTransactions]);

  const onTransactionChecked = () => {
    // Re-fetch transactions after one has been marked as checked
    startTransition(() => {
        fetchPendingTransactions();
    });
  };

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="flex flex-col gap-6">
        <CardHeader className="p-0">
            <CardTitle>Admin Verification</CardTitle>
            <CardDescription>Review and mark transactions as checked for accounting.</CardDescription>
        </CardHeader>
        <AdminClient 
            pendingTransactions={pendingTransactions} 
            onTransactionChecked={onTransactionChecked}
        />
    </div>
  );
}
