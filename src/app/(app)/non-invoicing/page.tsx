
'use client';
import { useState } from 'react';
import { TransactionForm } from "@/components/transactions/transaction-form";
import { ReceiptDialog } from '@/components/transactions/receipt-dialog';
import type { Transaction } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NonInvoicingPage() {
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  
  const handleTransactionAdded = (transaction: Transaction) => {
    setLastTransaction(transaction);
  };

  const handleReceiptClose = () => {
    setLastTransaction(null);
  };

  return (
    <div className="flex flex-col gap-6">
        <Card>
            <CardHeader>
                <CardTitle>PT Till</CardTitle>
                <CardDescription>
                    Use a Job ID to auto-fill details, or enter them manually to create a new transaction.
                </CardDescription>
            </CardHeader>
            <CardContent>
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
