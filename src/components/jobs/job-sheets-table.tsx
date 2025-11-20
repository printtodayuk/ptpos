'use client';

import { format } from 'date-fns';
import { MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { JobSheet } from '@/lib/types';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';


type JobSheetsTableProps = {
  jobSheets: JobSheet[];
  onView: (jobSheet: JobSheet) => void;
  onEdit: (jobSheet: JobSheet) => void;
  onDelete: (jobSheet: JobSheet) => void;
};

export function JobSheetsTable({ 
  jobSheets,
  onView,
  onEdit,
  onDelete,
}: JobSheetsTableProps) {

  if (jobSheets.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-10">
        No job sheets found.
      </div>
    );
  }

  const getStatusVariant = (status: JobSheet['status']) => {
    switch(status) {
        case 'Hold': return 'secondary';
        case 'Invoice': return 'default';
        case 'Cancel': return 'destructive';
        default: return 'outline';
    }
  }

  return (
    <div className="rounded-lg border-t">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job ID</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Client</TableHead>
            <TableHead className="hidden md:table-cell">Operator</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobSheets.map((js) => (
            <TableRow key={js.id}>
              <TableCell>
                <Badge variant="secondary">{js.jobId}</Badge>
              </TableCell>
              <TableCell className="font-medium">
                {format(new Date(js.date), 'dd/MM/yy')}
              </TableCell>
              <TableCell>{js.clientName}</TableCell>
              <TableCell className="hidden md:table-cell">{js.operator}</TableCell>
              <TableCell className="text-right">
                £{js.totalAmount.toFixed(2)}
              </TableCell>
              <TableCell className="text-center">
                 <Badge variant={getStatusVariant(js.status)}>
                    {js.status}
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
  );
}
