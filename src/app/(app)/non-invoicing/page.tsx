
'use client';
import { useState } from 'react';
import { TransactionForm } from "@/components/transactions/transaction-form";
import { ReceiptDialog } from '@/components/transactions/receipt-dialog';
import type { Transaction } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TillStats } from '@/components/transactions/till-stats';

export default function NonInvoicingPage() {
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [key, setKey] = useState(Date.now());
  
  const handleTransactionAdded = (transaction: Transaction) => {
    setLastTransaction(transaction);
    setKey(Date.now()); // Force re-render of stats
  };

  const handleReceiptClose = () => {
    setLastTransaction(null);
  };

  return (
    <div className="flex flex-col gap-6">
        <CardHeader className="p-0">
          <CardTitle>PT Till</CardTitle>
          <CardDescription>
              Use a Job ID to auto-fill details, or enter them manually to create a new transaction.
          </CardDescription>
        </CardHeader>
        
        <TillStats key={key} />

        <Card>
            <CardContent className="pt-6">
                <TransactionForm type="non-invoicing" onTransactionAdded={handleTransactionAdded} />
            </CardContent>
        </Card>
        
        <ReceiptDialog
            transaction={lastTransaction}
            isOpen={!!lastTransaction}
            onClose={handleReceiptClose}
        />
    </div>
  );
}
