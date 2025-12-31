
'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Eye, Edit, Trash2, History, FilePlus } from 'lucide-react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import type { Quotation, QuotationStatus } from '@/lib/types';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { SimplePagination } from '../ui/pagination';

const ROWS_PER_PAGE = 10;

type QuotationsTableProps = {
  quotations: Quotation[];
  onView: (quotation: Quotation) => void;
  onEdit: (quotation: Quotation) => void;
  onDelete: (quotation: Quotation) => void;
  onViewHistory: (quotation: Quotation) => void;
  onCreateJob: (quotation: Quotation) => void;
};

export function QuotationsTable({ 
  quotations,
  onView,
  onEdit,
  onDelete,
  onViewHistory,
  onCreateJob,
}: QuotationsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(quotations.length / ROWS_PER_PAGE);

  const paginatedQuotations = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return quotations.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [quotations, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
    }
  };

  if (quotations.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-10">
        No quotations found.
      </div>
    );
  }

  const getStatusClass = (status: QuotationStatus): string => {
    switch (status) {
      case 'Sent':
        return 'bg-blue-500 hover:bg-blue-500/80 text-white';
      case 'Hold':
        return 'bg-yellow-500 hover:bg-yellow-500/80 text-black';
      case 'WFR':
         return 'bg-purple-500 hover:bg-purple-500/80 text-white';
      case 'Approved':
        return 'bg-green-600 hover:bg-green-600/80 text-white';
      case 'Declined':
        return 'bg-destructive hover:bg-destructive/80 text-destructive-foreground';
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
            <TableHead>Quotation ID</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Client</TableHead>
            <TableHead className="hidden md:table-cell">Type</TableHead>
            <TableHead className="hidden md:table-cell">Operator</TableHead>
            <TableHead className="hidden lg:table-cell">JID</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedQuotations.map((q) => (
            <TableRow key={q.id}>
              <TableCell>
                <Badge variant="secondary">{q.quotationId}</Badge>
              </TableCell>
              <TableCell className="font-medium">
                {format(new Date(q.date), 'dd/MM/yy')}
              </TableCell>
              <TableCell>{q.clientName}</TableCell>
              <TableCell className="hidden md:table-cell">{q.type}</TableCell>
              <TableCell className="hidden md:table-cell">{q.operator}</TableCell>
              <TableCell className="hidden lg:table-cell">{q.jid}</TableCell>
              <TableCell className="text-right">
                £{q.totalAmount.toFixed(2)}
              </TableCell>
              <TableCell className="text-center">
                 <Badge 
                    className={cn('border-transparent', getStatusClass(q.status))}
                  >
                    {q.status}
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
                    <DropdownMenuItem onSelect={() => onView(q)}>
                      <Eye className="mr-2 h-4 w-4" /> View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onViewHistory(q)}>
                        <History className="mr-2 h-4 w-4" /> View History
                    </DropdownMenuItem>
                     <DropdownMenuItem onSelect={() => onCreateJob(q)}>
                        <FilePlus className="mr-2 h-4 w-4" /> Create Job
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => onEdit(q)}>
                      <Edit className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onDelete(q)} className="text-destructive focus:text-destructive">
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
