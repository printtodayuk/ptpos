
'use client';

import { useState, useTransition, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { Loader2, Edit, Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { getTimeRecordsForReport } from '@/lib/server-actions-attendance';
import type { TimeRecord } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { PinLock } from '@/components/admin/pin-lock';
import { EditTimeRecordDialog } from '@/components/admin/edit-time-record-dialog';
import { SimplePagination } from '@/components/ui/pagination';


const ROWS_PER_PAGE = 10;

function formatDuration(minutes: number | null | undefined) {
    if (minutes === null || typeof minutes === 'undefined' || isNaN(minutes) || minutes < 0) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
}

export default function AdminTimePage() {
    const [records, setRecords] = useState<TimeRecord[]>([]);
    const [isSearching, startSearchTransition] = useTransition();
    const [date, setDate] = useState<DateRange | undefined>();
    const [recordToEdit, setRecordToEdit] = useState<TimeRecord | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

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

    const handleEditSuccess = () => {
        setRecordToEdit(null);
        performSearch(date);
    };

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    return (
        <PinLock>
            <EditTimeRecordDialog
                record={recordToEdit}
                isOpen={!!recordToEdit}
                onClose={() => setRecordToEdit(null)}
                onSuccess={handleEditSuccess}
            />
            <div className="flex flex-col gap-6">
                <CardHeader className="p-0">
                    <CardTitle>Admin Time Management</CardTitle>
                    <CardDescription>View and edit operator time records.</CardDescription>
                </CardHeader>
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
                                        <TableHead><span className="sr-only">Actions</span></TableHead>
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
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => setRecordToEdit(record)}>
                                                <Edit className="h-4 w-4" />
                                                <span className="sr-only">Edit</span>
                                            </Button>
                                        </TableCell>
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
        </PinLock>
    );
}
