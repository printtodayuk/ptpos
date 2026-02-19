'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Eye, Edit, Trash2, CreditCard, History, Printer, Truck } from 'lucide-react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import type { JobSheet, JobSheetStatus, PaymentStatus } from '@/lib/types';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { SimplePagination } from '../ui/pagination';

const ROWS_PER_PAGE = 10;

type JobSheetsTableProps = {
  jobSheets: JobSheet[];
  onView: (jobSheet: JobSheet) => void;
  onEdit: (jobSheet: JobSheet) => void;
  onDelete: (jobSheet: JobSheet) => void;
  onPay: (jobSheet: JobSheet) => void;
  onViewHistory: (jobSheet: JobSheet) => void;
  onPrint: (jobSheet: JobSheet) => void;
  onDeliveryNote: (jobSheet: JobSheet) => void;
};

export function JobSheetsTable({ 
  jobSheets,
  onView,
  onEdit,
  onDelete,
  onPay,
  onViewHistory,
  onPrint,
  onDeliveryNote
}: JobSheetsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(jobSheets.length / ROWS_PER_PAGE);

  const paginatedJobSheets = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return jobSheets.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [jobSheets, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
    }
  };

  if (jobSheets.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-10">
        No job sheets found.
      </div>
    );
  }

  const getStatusClass = (status: JobSheetStatus): string => {
    switch (status) {
      case 'Hold':
        return 'bg-red-500 hover:bg-red-500/80 text-white';
      case 'Studio':
        return 'bg-blue-500 hover:bg-blue-500/80 text-white';
      case 'Production':
        return 'bg-orange-500 hover:bg-orange-500/80 text-white';
      case 'Finishing':
        return 'bg-teal-500 hover:bg-teal-500/80 text-white';
      case 'Cancel':
        return 'bg-destructive hover:bg-destructive/80 text-destructive-foreground';
      case 'Ready Pickup':
        return 'bg-purple-500 hover:bg-purple-500/80 text-white';
      case 'Parcel Compare':
         return 'bg-yellow-500 hover:bg-yellow-500/80 text-black';
      case 'Delivered':
        return 'bg-green-600 hover:bg-green-600/80 text-white';
      case 'MGH':
        return 'bg-pink-500 hover:bg-pink-500/80 text-white';
      case 'OS':
        return 'bg-indigo-500 hover:bg-indigo-500/80 text-white';
      default:
        return 'bg-gray-500 hover:bg-gray-500/80 text-white';
    }
  };
  
  const getPaymentStatusClass = (status?: PaymentStatus): string => {
    switch (status) {
      case 'Paid':
        return 'bg-green-700 hover:bg-green-700/80 text-white';
      case 'Partially Paid':
        return 'bg-yellow-500 hover:bg-yellow-500/80 text-black';
      case 'Unpaid':
        return 'bg-red-500 hover:bg-red-500/80 text-white';
      default:
        return 'bg-gray-500 hover:bg-gray-500/80 text-white';
    }
  };


  return (
    <>
    <div className="rounded-lg border-t">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job ID</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Company</TableHead>
            <TableHead className="hidden md:table-cell">Type</TableHead>
            <TableHead className="hidden md:table-cell">Operator</TableHead>
            <TableHead className="hidden lg:table-cell">IR Number</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-center">Job Status</TableHead>
            <TableHead className="text-center">Payment Status</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedJobSheets.map((js) => (
            <TableRow key={js.id}>
              <TableCell>
                <Badge variant="secondary">{js.jobId}</Badge>
              </TableCell>
              <TableCell className="font-medium">
                {format(new Date(js.date), 'dd/MM/yy')}
              </TableCell>
              <TableCell>{js.clientName}</TableCell>
              <TableCell className="text-muted-foreground">{js.companyName || '-'}</TableCell>
              <TableCell className="hidden md:table-cell">{js.type}</TableCell>
              <TableCell className="hidden md:table-cell">{js.operator}</TableCell>
              <TableCell className="hidden lg:table-cell">{js.irNumber}</TableCell>
              <TableCell className="text-right">
                £{js.totalAmount.toFixed(2)}
              </TableCell>
              <TableCell className="text-center">
                 <Badge 
                    className={cn('border-transparent', getStatusClass(js.status))}
                  >
                    {js.status}
                </Badge>
              </TableCell>
               <TableCell className="text-center">
                 <Badge 
                    className={cn('border-transparent', getPaymentStatusClass(js.paymentStatus))}
                  >
                    {js.paymentStatus || 'Unpaid'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-haspopup="true" size="icon" variant="ghost">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Toggle menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onView(js)}>
                      <Eye className="mr-2 h-4 w-4" /> View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onPrint(js)}>
                      <Printer className="mr-2 h-4 w-4" /> Print Worksheet
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onDeliveryNote(js)}>
                      <Truck className="mr-2 h-4 w-4" /> Print DN
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onViewHistory(js)}>
                        <History className="mr-2 h-4 w-4" /> View History
                    </DropdownMenuItem>
                     <DropdownMenuItem onSelect={() => onPay(js)} disabled={js.paymentStatus === 'Paid'}>
                      <CreditCard className="mr-2 h-4 w-4" /> Pay Now
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => onEdit(js)}>
                      <Edit className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onDelete(js)} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    <SimplePagination 
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
    />
    </>
  );
}
