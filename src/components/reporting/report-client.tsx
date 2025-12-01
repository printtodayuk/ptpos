
'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Download, Loader2, Search, Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getReportData } from '@/lib/server-actions';
import type { Transaction } from '@/lib/types';
import { cn, exportToCsv } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { Card, CardContent } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransactionsTable } from '../transactions/transactions-table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';

export function ReportClient() {
  const [isPending, startTransition] = useTransition();
  const [isExporting, startExportTransition] = useTransition();
  const [invoicingTransactions, setInvoicingTransactions] = useState<Transaction[]>([]);
  const [nonInvoicingTransactions, setNonInvoicingTransactions] = useState<Transaction[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState('invoicing');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [date, setDate] = useState<DateRange | undefined>();
  const { toast } = useToast();

  const performSearch = useCallback((term: string, dateRange?: DateRange) => {
    startTransition(async () => {
      const data = await getReportData({ 
        searchTerm: term,
        startDate: dateRange?.from?.toISOString(),
        endDate: dateRange?.to?.toISOString(),
      });
      setInvoicingTransactions(data.filter(t => t.type === 'invoicing'));
      setNonInvoicingTransactions(data.filter(t => t.type === 'non-invoicing'));
      setHasSearched(true);
    });
  }, []);

  useEffect(() => {
    performSearch(debouncedSearchTerm, date);
  }, [debouncedSearchTerm, date, performSearch]);

  const handleExport = () => {
    startExportTransition(async () => {
      const transactionsToExport = await getReportData({
        searchTerm: debouncedSearchTerm,
        startDate: date?.from?.toISOString(),
        endDate: date?.to?.toISOString(),
      });
      
      if (!transactionsToExport || transactionsToExport.length === 0) {
        toast({ variant: 'destructive', title: 'Nothing to Export', description: 'No transactions match the current filters.' });
        return;
      }

      const filename = `transactions_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      const dataToExport = transactionsToExport.map(t => ({
          transactionId: t.transactionId,
          date: format(new Date(t.date), 'yyyy-MM-dd'),
          clientName: t.clientName,
          type: t.type,
          invoiceNumber: t.invoiceNumber || '',
          jid: t.jid || '',
          amount: t.amount.toFixed(2),
          vatApplied: t.vatApplied,
          totalAmount: t.totalAmount.toFixed(2),
          paidAmount: t.paidAmount.toFixed(2),
          dueAmount: t.dueAmount.toFixed(2),
          paymentMethod: t.paymentMethod,
          operator: t.operator,
          adminChecked: t.adminChecked,
          checkedBy: t.checkedBy || '',
      }));
      exportToCsv(filename, dataToExport);
      toast({ title: 'Success', description: 'Transactions exported successfully.' });
    });
  };

  const hasData = invoicingTransactions.length > 0 || nonInvoicingTransactions.length > 0;
  
  const onTransactionChecked = () => {
    performSearch(debouncedSearchTerm, date);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search by TID, JID, client name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10"
                    />
                </div>
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-full sm:w-[300px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                            <>
                                {format(date.from, "LLL dd, y")} -{" "}
                                {format(date.to, "LLL dd, y")}
                            </>
                            ) : (
                            format(date.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date range</span>
                        )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                        />
                    </PopoverContent>
                </Popover>
                {hasData && (
                    <Button onClick={handleExport} disabled={isExporting} variant="outline" className="w-full sm:w-auto flex-shrink-0">
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Export CSV
                    </Button>
                )}
            </div>
        </CardContent>
      </Card>
      
      <Card>
          {isPending && (
             <div className="p-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-8 w-8 animate-spin" />
            </div>
          )}

          {!isPending && hasSearched && !hasData && (
            <div className="p-10 text-center text-muted-foreground">
                No data found for your search.
            </div>
          )}

          {!isPending && hasData && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="m-4">
                <TabsTrigger value="invoicing">Xero ({invoicingTransactions.length})</TabsTrigger>
                <TabsTrigger value="non-invoicing">PT Till ({nonInvoicingTransactions.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="invoicing" className="m-0 p-0">
                  <TransactionsTable 
                    transactions={invoicingTransactions}
                    showAdminControls={false}
                    onTransactionChecked={onTransactionChecked}
                  />
              </TabsContent>
              <TabsContent value="non-invoicing" className="m-0 p-0">
                  <TransactionsTable 
                    transactions={nonInvoicingTransactions}
                    showAdminControls={false}
                    onTransactionChecked={onTransactionChecked}
                   />
              </TabsContent>
            </Tabs>
          )}
          
          {!isPending && !hasSearched && (
            <div className="p-10 text-center text-muted-foreground">
                Loading transactions...
            </div>
          )}
      </Card>
    </div>
  );
}
