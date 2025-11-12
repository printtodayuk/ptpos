'use client';
import { useState } from 'react';
import { TransactionForm } from "@/components/transactions/transaction-form";
import { SearchTransactions } from '@/components/transactions/search-transactions';

export default function NonInvoicingPage() {
  const [key, setKey] = useState(Date.now());

  const handleTransactionUpdate = () => {
    // Re-render the search component to fetch fresh data
    setKey(Date.now());
  };

  return (
    <div className="flex flex-col gap-6">
      <TransactionForm type="non-invoicing" onTransactionAdded={handleTransactionUpdate} />
      <SearchTransactions key={key} type="non-invoicing" onTransactionUpdated={handleTransactionUpdate} />
    </div>
  );
}
