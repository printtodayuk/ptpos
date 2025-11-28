'use client';
import { useState } from 'react';
import { TransactionForm } from "@/components/transactions/transaction-form";

export default function NonInvoicingPage() {
  const [key, setKey] = useState(Date.now());

  const handleTransactionAdded = () => {
    // Re-render the form to clear it after successful submission
    setKey(Date.now());
  };

  return (
    <div className="flex flex-col gap-6">
      <TransactionForm 
        key={key} 
        type="non-invoicing" 
        onTransactionAdded={handleTransactionAdded} 
      />
    </div>
  );
}
