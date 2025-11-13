'use client';

import { useState, useTransition } from 'react';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { Calendar as CalendarIcon, Download, Loader2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { enGB } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getReportData } from '@/lib/server-actions';
import type { Transaction } from '@/lib/types';
import { cn, exportToCsv } from '@/lib/utils';
import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransactionsTable } from '../transactions/transactions-table';

export function ReportClient() {
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [invoicingTransactions, setInvoicingTransactions] = useState<Transaction[]>([]);
  const [nonInvoicingTransactions, setNonInvoicingTransactions] = useState<Transaction[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState('invoicing');

  const handleSearch = () => {
    if (!date?.from || !date?.to) return;

    startTransition(async () => {
      const data = await getReportData({ from: date.from!, to: date.to! });
      setInvoicingTransactions(data.filter(t => t.type === 'invoicing'));
      setNonInvoicingTransactions(data.filter(t => t.type === 'non-invoicing'));
      setHasSearched(true);
    });
  };

  const handleExport = () => {
    const transactionsToExport = activeTab === 'invoicing' ? invoicingTransactions : nonInvoicingTransactions;
    if (transactionsToExport.length === 0) return;

    const filename = `${activeTab}_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    const dataToExport = transactionsToExport.map(t => ({
        transactionId: t.transactionId,
        date: format(t.date, 'yyyy-MM-dd'),
        clientName: t.clientName,
        type: t.type,
        invoiceNumber: t.invoiceNumber || '',
        amount: t.amount.toFixed(2),
        vatApplied: t.vatApplied,
        totalAmount: t.totalAmount.toFixed(2),
        paymentMethod: t.paymentMethod,
        operator: t.operator,
        adminChecked: t.adminChecked,
        checkedBy: t.checkedBy || '',
    }));
    exportToCsv(filename, dataToExport);
  };
  
  const setDailyRange = () => {
    const today = new Date();
    setDate({ from: startOfDay(today), to: endOfDay(today) });
  };
  
  const setMonthlyRange = () => {
    const today = new Date();
    setDate({ from: startOfMonth(today), to: endOfMonth(today) });
  }

  const hasData = invoicingTransactions.length > 0 || nonInvoicingTransactions.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={'outline'}
              className={cn(
                'w-[300px] justify-start text-left font-normal',
                !date && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, 'LLL dd, y')} -{' '}
                    {format(date.to, 'LLL dd, y')}
                  </>
                ) : (
                  format(date.from, 'LLL dd, y')
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
              locale={enGB}
            />
          </PopoverContent>
        </Popover>
        <Button variant="secondary" onClick={setDailyRange}>Today</Button>
        <Button variant="secondary" onClick={setMonthlyRange}>This Month</Button>
        <Button onClick={handleSearch} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Generate Report
        </Button>
        {hasData && (
            <Button onClick={handleExport} variant="outline" className="ml-auto">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
            </Button>
        )}
      </div>

      <Card>
          {isPending && (
             <div className="p-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-8 w-8 animate-spin" />
            </div>
          )}

          {!isPending && hasSearched && !hasData && (
            <div className="p-10 text-center text-muted-foreground">
                No data found for the selected period.
            </div>
          )}

          {!isPending && hasData && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="m-4">
                <TabsTrigger value="invoicing">Xero ({invoicingTransactions.length})</TabsTrigger>
                <TabsTrigger value="non-invoicing">PT Till ({nonInvoicingTransactions.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="invoicing" className="m-0 p-0">
                  <TransactionsTable transactions={invoicingTransactions} />
              </TabsContent>
              <TabsContent value="non-invoicing" className="m-0 p-0">
                  <TransactionsTable transactions={nonInvoicingTransactions} />
              </TabsContent>
            </Tabs>
          )}
          
          {!isPending && !hasSearched && (
            <div className="p-10 text-center text-muted-foreground">
                Select a date range and click "Generate Report" to see data.
            </div>
          )}
      </Card>
    </div>
  );
}
