'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { format } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { Clock, Receipt, RefreshCw, Sparkles, Store } from 'lucide-react';

import { FeatureGuard } from '@/components/features/feature-guard';
import { TillStats } from '@/components/transactions/till-stats';
import { TillForm } from '@/components/transactions/till-form';
import { TillLogsSection } from '@/components/transactions/till-logs-section';
import { ReceiptDialog } from '@/components/transactions/receipt-dialog';
import { Button } from '@/components/ui/button';
import { getTillTransactionsByDate } from '@/lib/server-actions';
import { autoCreateAllPendingTillJids, sweepPreviousDaysUnassignedTill } from '@/lib/server-actions-jobs';
import { getLondonCurrentDate, getLondonDateString, getLondonTimeParts } from '@/lib/london-time';
import { useToast } from '@/hooks/use-toast';
import type { Transaction } from '@/lib/types';

export default function NonInvoicingPage() {
  // Use London current calendar date so Till aligns with London shop operations
  const [selectedDate, setSelectedDate] = useState<Date>(() => getLondonCurrentDate());
  const [londonTimeStr, setLondonTimeStr] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [, startTransition] = useTransition();
  const { toast } = useToast();

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

  // Fetch transactions whenever selected date changes
  useEffect(() => {
    fetchDayTransactions(selectedDate);
  }, [selectedDate, fetchDayTransactions]);

  // Initial self-healing sweep: auto-create JIDs for any unassigned till sales from previous London days
  useEffect(() => {
    sweepPreviousDaysUnassignedTill().then((res) => {
      if (res.success && res.totalCreated > 0) {
        toast({
          title: 'Till Auto-Sweep Completed',
          description: `${res.totalCreated} past Job Sheet(s) auto-created for Walking Client.`,
        });
        fetchDayTransactions(selectedDate);
      }
    }).catch((err) => {
      console.error('Error sweeping past till logs:', err);
    });
  }, [selectedDate, fetchDayTransactions, toast]);

  // London time live clock & 23:59 auto-close trigger
  useEffect(() => {
    let lastHandledDay = getLondonDateString();

    const updateClockAndCheckReset = () => {
      const parts = getLondonTimeParts();
      const timeFormatted = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
      setLondonTimeStr(timeFormatted);

      const currentDay = parts.dateStr;
      // If London time rolls past 23:59 or day crosses midnight
      if (currentDay !== lastHandledDay || parts.isPast2359) {
        lastHandledDay = currentDay;

        // Auto-create JIDs for Walking Client for the ending day
        autoCreateAllPendingTillJids({
          targetDate: selectedDate,
          operator: 'PTTill (Auto 23:59)',
        }).then((res) => {
          if (res.success && res.createdJobs.length > 0) {
            toast({
              title: 'London 23:59 Till Auto-Closed',
              description: `Till reset for new day. ${res.createdJobs.length} Job Sheet(s) auto-created for Walking Client.`,
            });
            // Advance selectedDate to the new London day
            setSelectedDate(getLondonCurrentDate());
          }
        }).catch((err) => {
          console.error('Error in London 23:59 auto-close:', err);
        });
      }
    };

    updateClockAndCheckReset();
    const interval = setInterval(updateClockAndCheckReset, 20000); // Check every 20 seconds
    return () => clearInterval(interval);
  }, [selectedDate, toast]);

  const handleTransactionAdded = (transaction: Transaction) => {
    setLastTransaction(transaction);
    if (transaction && transaction.id) {
      setTransactions((prev) => {
        const filtered = prev.filter((t) => t.id !== transaction.id);
        return [transaction, ...filtered];
      });
    }
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

          <div className="flex items-center gap-2.5">
            {/* Live London Clock & Auto-Close Badge */}
            {londonTimeStr && (
              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm">
                <Clock className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
                <span>London: {londonTimeStr}</span>
                <span className="text-[10px] text-slate-400 font-normal hidden md:inline ml-0.5">• Auto-closes 23:59</span>
              </div>
            )}

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

        {/* 2. Till Sale Form */}
        <TillForm
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onTransactionAdded={handleTransactionAdded}
        />

        {/* 3. Daily Sales Logs Filtered by Payment Method + Create JID */}
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
