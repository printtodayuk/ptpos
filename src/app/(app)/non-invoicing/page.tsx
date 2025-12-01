
'use client';
import { useState, useEffect } from 'react';
import { TransactionForm } from "@/components/transactions/transaction-form";
import { ReceiptDialog } from '@/components/transactions/receipt-dialog';
import type { Transaction } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats } from '@/lib/server-actions';
import { StatCard } from '@/components/dashboard/stat-card';
import { PoundSterling, Hash, Landmark, CreditCard, HandCoins, CalendarClock } from 'lucide-react';
import { Loader2 } from 'lucide-react';


export default function NonInvoicingPage() {
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalInputs: 0,
    bankAmount: 0,
    cardAmount: 0,
    cashAmount: 0,
    dailyCash: 0,
    dailyBank: 0,
    dailyCard: 0,
    productionCount: 0,
    holdCount: 0,
    unpaidCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getDashboardStats().then(data => {
      if (data) {
        setStats(data);
      }
      setIsLoading(false);
    });
  }, [lastTransaction]);
  
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

        {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        ) : (
            <>
                <Card>
                    <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <CalendarClock className="h-5 w-5" />
                        Today's Sales Summary
                    </CardTitle>
                    <CardDescription>
                        Live sales figures for today. This will reset at midnight.
                    </CardDescription>
                    </CardHeader>
                    <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard title="Total Daily Sales" value={stats.dailyBank + stats.dailyCard + stats.dailyCash} icon={PoundSterling} />
                        <StatCard title="Daily Bank Transfers" value={stats.dailyBank} icon={Landmark} />
                        <StatCard title="Daily Card Payments" value={stats.dailyCard} icon={CreditCard} />
                        <StatCard title="Daily Cash Payments" value={stats.dailyCash} icon={HandCoins} />
                    </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                    <CardTitle className="text-xl">All-Time Statistics</CardTitle>
                    <CardDescription>
                        A running total of all transactions recorded in the system.
                    </CardDescription>
                    </CardHeader>
                    <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard title="Total Inputs" value={stats.totalInputs} icon={Hash} description="Total records entered" isCurrency={false} />
                        <StatCard title="Total from Bank" value={stats.bankAmount} icon={Landmark} description="Total amount via bank" />
                        <StatCard title="Total from Card" value={stats.cardAmount} icon={CreditCard} description="Total amount via card" />
                        <StatCard title="Total from Cash" value={stats.cashAmount} icon={HandCoins} description="Total amount in cash" />
                    </div>
                    </CardContent>
                </Card>
            </>
        )}
    </div>
  );
}
