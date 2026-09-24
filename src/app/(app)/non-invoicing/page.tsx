'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { format } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { Receipt, RefreshCw, Sparkles, Store } from 'lucide-react';

import { FeatureGuard } from '@/components/features/feature-guard';
import { TillStats } from '@/components/transactions/till-stats';
import { TillForm } from '@/components/transactions/till-form';
import { TillLogsSection } from '@/components/transactions/till-logs-section';
import { ReceiptDialog } from '@/components/transactions/receipt-dialog';
import { Button } from '@/components/ui/button';
import { getTillTransactionsByDate } from '@/lib/server-actions';
import type { Transaction } from '@/lib/types';

export default function NonInvoicingPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [, startTransition] = useTransition();

  const fetchDayTransactions = useCallback((date: Date) => {
    setIsLoading(true);
    startTransition(async () => {
      try {
        const data = await getTillTransactionsByDate(date);
        setTransactions(data);
      } catch (err) {
        console.error('Failed to fetch till transactions:', err);
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    fetchDayTransactions(selectedDate);
  }, [selectedDate, fetchDayTransactions]);

  const handleTransactionAdded = (transaction: Transaction) => {
    setLastTransaction(transaction);
    fetchDayTransactions(selectedDate);
  };

  const handleRefresh = () => {
    fetchDayTransactions(selectedDate);
  };

  return (
    <FeatureGuard featureKey="transactions">
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">
        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md">
                <Store className="h-6 w-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                PT Till
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Record walk-in sales, monitor real-time sales by payment method, and automatically generate Job Sheets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="rounded-xl h-10 px-3.5 border-slate-200 dark:border-slate-800 text-xs font-bold shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* 1. Related Sales Summary Cards */}
        <TillStats
          transactions={transactions}
          loading={isLoading}
          dateLabel={format(selectedDate, 'dd/MM/yyyy', { locale: enGB })}
        />

        {/* 2. Till Sale Form (Without JID, prefilled system date, client/phone, desc, qty, amount, VAT 20%, payment method) */}
        <TillForm
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onTransactionAdded={handleTransactionAdded}
        />

        {/* 3. Daily Sales Logs Filtered by Payment Method + Create JID for Each Section */}
        <TillLogsSection
          selectedDate={selectedDate}
          transactions={transactions}
          isLoading={isLoading}
          onRefresh={handleRefresh}
        />

        {/* Thermal Receipt Dialog on Sale Added */}
        <ReceiptDialog
          transaction={lastTransaction}
          isOpen={!!lastTransaction}
          onClose={() => setLastTransaction(null)}
        />
      </div>
    </FeatureGuard>
  );
}
