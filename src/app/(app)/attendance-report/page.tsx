'use client';

import { useState, useTransition, useEffect, useCallback, useMemo } from 'react';
import { format, startOfMonth } from 'date-fns';
import { Download, Loader2, Calendar as CalendarIcon, User, Clock } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { getTimeRecordsForReport, getMonthlyStats } from '@/lib/server-actions-attendance';
import type { TimeRecord, Operator } from '@/lib/types';
import { operators } from '@/lib/types';
import { cn, exportToCsv } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { SimplePagination } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const ROWS_PER_PAGE = 10;

function formatDuration(minutes: number | null | undefined) {
    if (minutes === null || typeof minutes === 'undefined' || isNaN(minutes) || minutes < 0) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
}

export default function AttendanceReportPage() {
    const [records, setRecords] = useState<TimeRecord[]>([]);
    const [isSearching, startSearchTransition] = useTransition();
    const [isExporting, startExportTransition] = useTransition();
    const [date, setDate] = useState<DateRange | undefined>();
    const [currentPage, setCurrentPage] = useState(1);
    
    const [selectedOperator, setSelectedOperator] = useState<Operator>('PTMGH');
    const [monthlyMinutes, setMonthlyMinutes] = useState<number | null>(null);
    const [isStatsLoading, setIsStatsLoading] = useState(false);

    const { toast } = useToast();

    const totalPages = Math.ceil(records.length / ROWS_PER_PAGE);

    const paginatedRecords = useMemo(() => {
        const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
        return records.slice(startIndex, startIndex + ROWS_PER_PAGE);
    }, [records, currentPage]);

    const performSearch = useCallback((dateRange?: DateRange) => {
        startSearchTransition(async () => {
            const endOfDay = dateRange?.to ? new Date(dateRange.to.setHours(23, 59, 59, 999)) : undefined;
            const data = await getTimeRecordsForReport({
                startDate: dateRange?.from?.toISOString(),
                endDate: endOfDay?.toISOString(),
            });
            setRecords(data);
            setCurrentPage(1);
        });
    }, []);

    useEffect(() => {
        performSearch(date);
    }, [date, performSearch]);

    useEffect(() => {
        if (selectedOperator) {
            setIsStatsLoading(true);
            getMonthlyStats(selectedOperator).then(res => {
                setMonthlyMinutes(res.totalMinutes);
                setIsStatsLoading(false);
            });
        }
    }, [selectedOperator]);

    const handleExport = () => {
        startExportTransition(() => {
            if (records.length === 0) {
                toast({ variant: 'destructive', title: 'Nothing to Export' });
                return;
            }
            const dataToExport = records.map(r => ({
                'Date': format(r.clockInTime, 'yyyy-MM-dd'),
                'Operator': r.operator,
                'Clock In': format(r.clockInTime, 'p'),
                'Clock Out': r.clockOutTime ? format(r.clockOutTime, 'p') : 'N/A',
                'Status': r.status,
                'Work Duration': formatDuration(r.totalWorkDuration),
                'Break Duration': formatDuration(r.totalBreakDuration),
            }));
            exportToCsv(`time-report_${new Date().toISOString().split('T')[0]}.csv`, dataToExport);
            toast({ title: 'Success', description: 'Report exported successfully.' });
        });
    };

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <CardHeader className="p-0">
                <CardTitle>Attendance Report</CardTitle>
                <CardDescription>View and export operator time records.</CardDescription>
            </CardHeader>

            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        Monthly Work Summary ({format(new Date(), 'MMMM yyyy')})
                    </CardTitle>
                    <CardDescription>Select an operator to see their total work hours for this month.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-full sm:w-[250px] space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" /> Select Operator
                        </label>
                        <Select value={selectedOperator} onValueChange={(val) => setSelectedOperator(val as Operator)}>
                            <SelectTrigger className="bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {operators.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1 p-4 bg-white rounded-xl border border-primary/10 shadow-sm flex items-center justify-center min-h-[80px]">
                        {isStatsLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        ) : (
                            <div className="text-center">
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Total Month Time for {selectedOperator}</p>
                                <p className="text-3xl font-bold text-primary">{formatDuration(monthlyMinutes)}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-center gap-2">
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
                                                {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                                            </>
                                        ) : (
                                            format(date.from, "LLL dd, y")
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
                                />
                            </PopoverContent>
                        </Popover>
                        <Button onClick={handleExport} disabled={isExporting || records.length === 0} variant="outline" className="w-full sm:w-auto">
                            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Export as CSV
                        </Button>
                    </div>

                    <div className="mt-4 border rounded-lg">
                         {isSearching ? (
                            <div className="flex justify-center items-center p-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : records.length === 0 ? (
                            <div className="text-center text-muted-foreground p-10">
                                No records found for the selected period.
                            </div>
                        ) : (
                            <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Operator</TableHead>
                                        <TableHead>Clock In</TableHead>
                                        <TableHead>Clock Out</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Work Duration</TableHead>
                                        <TableHead>Break Duration</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedRecords.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell>{format(record.clockInTime, 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>{record.operator}</TableCell>
                                        <TableCell>{format(record.clockInTime, 'p')}</TableCell>
                                        <TableCell>{record.clockOutTime ? format(record.clockOutTime, 'p') : 'N/A'}</TableCell>
                                        <TableCell>
                                            <Badge variant={record.status === 'clocked-out' ? 'default' : 'secondary'} className={cn(record.status === 'clocked-out' && 'bg-green-500 text-white')}>
                                                {record.status.replace('-', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{formatDuration(record.totalWorkDuration)}</TableCell>
                                        <TableCell>{formatDuration(record.totalBreakDuration)}</TableCell>
                                    </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <SimplePagination 
                                currentPage={currentPage} 
                                totalPages={totalPages} 
                                onPageChange={handlePageChange}
                                className="p-4 border-t"
                            />
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
