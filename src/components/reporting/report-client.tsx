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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getReportData } from '@/lib/actions';
import type { Transaction } from '@/lib/types';
import { cn, exportToCsv } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';

export function ReportClient() {
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = () => {
    if (!date?.from || !date?.to) return;

    startTransition(async () => {
      const data = await getReportData({ from: date.from!, to: date.to! });
      setTransactions(data);
      setHasSearched(true);
    });
  };

  const handleExport = () => {
    const filename = `report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    const dataToExport = transactions.map(t => ({
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
        {transactions.length > 0 && (
            <Button onClick={handleExport} variant="outline" className="ml-auto">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
            </Button>
        )}
      </div>

      <Card>
          {hasSearched && transactions.length === 0 && (
            <div className="p-10 text-center text-muted-foreground">
                No data found for the selected period.
            </div>
          )}

          {transactions.length > 0 && (
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Admin Checked</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                        <TableCell>{format(tx.date, 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{tx.clientName}</TableCell>
                        <TableCell><Badge variant={tx.type === 'invoicing' ? 'default' : 'secondary'}>{tx.type}</Badge></TableCell>
                        <TableCell><Badge variant="outline">{tx.paymentMethod}</Badge></TableCell>
                        <TableCell>
                            <Badge variant={tx.adminChecked ? 'default' : 'destructive'} className={cn(tx.adminChecked && 'bg-green-600')}>{tx.adminChecked ? 'Yes' : 'No'}</Badge>
                        </TableCell>
                        <TableCell className="text-right">£{tx.totalAmount.toFixed(2)}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </div>
          )}
          
          {!hasSearched && (
            <div className="p-10 text-center text-muted-foreground">
                Select a date range and click "Generate Report" to see data.
            </div>
          )}
      </Card>
    </div>
  );
}
