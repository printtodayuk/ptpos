
'use client';

import { useState, useTransition, useMemo } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Eye, Edit, Trash2, CheckCircle, Search, Building2, Filter, X, FileText } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Invoice, CompanyProfile, InvoiceStatus } from '@/lib/types';
import { setInvoiceStatus } from '@/lib/server-actions-invoices';
import { useToast } from '@/hooks/use-toast';

type InvoicesTableProps = {
  invoices: Invoice[];
  companyProfiles: CompanyProfile[];
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onView: (invoice: Invoice) => void;
  onStatusChange: () => void;
};

export function InvoicesTable({ invoices, companyProfiles, onEdit, onDelete, onView, onStatusChange }: InvoicesTableProps) {
  const { toast } = useToast();
  const [isUpdating, startUpdateTransition] = useTransition();

  // Filter states
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const getProfileName = (profileId: string) => {
    return companyProfiles.find(p => p.id === profileId)?.name || 'Unknown';
  };

  const handleSetStatus = (id: string, status: InvoiceStatus) => {
    startUpdateTransition(async () => {
        const result = await setInvoiceStatus(id, status);
        if (result.success) {
            toast({ title: "Success", description: `Invoice marked as ${status}.` });
            onStatusChange();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
    });
  };

  const getStatusClass = (status: InvoiceStatus) => {
      switch(status) {
          case 'Paid': return 'bg-emerald-600 text-white';
          case 'Partially Paid': return 'bg-amber-600 text-white';
          case 'Sent': return 'bg-blue-600 text-white';
          case 'Overdue': return 'bg-rose-600 text-white';
          case 'Refunded': return 'bg-purple-600 text-white';
          case 'Draft':
          default: return 'bg-slate-500 text-white';
      }
  };

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Company filter
      if (companyFilter !== 'all' && inv.companyProfileId !== companyFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all' && inv.status !== statusFilter) {
        return false;
      }
      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const invoiceIdMatch = (inv.invoiceId || '').toLowerCase().includes(term);
        const clientMatch = (inv.clientName || '').toLowerCase().includes(term);
        const companyMatch = (inv.companyName || '').toLowerCase().includes(term);
        const profileMatch = getProfileName(inv.companyProfileId).toLowerCase().includes(term);
        const notesMatch = (inv.notes || '').toLowerCase().includes(term);
        if (!invoiceIdMatch && !clientMatch && !companyMatch && !profileMatch && !notesMatch) {
          return false;
        }
      }
      return true;
    });
  }, [invoices, companyFilter, statusFilter, searchTerm, companyProfiles]);

  const hasActiveFilters = companyFilter !== 'all' || statusFilter !== 'all' || searchTerm.trim() !== '';

  const resetFilters = () => {
    setCompanyFilter('all');
    setStatusFilter('all');
    setSearchTerm('');
  };

  if (invoices.length === 0) {
    return <div className="text-center text-muted-foreground p-10">No invoices created yet.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-muted/40 p-3.5 rounded-2xl border border-border/70">
        <div className="flex flex-1 flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Invoice ID, client, company..."
              className="pl-9 h-10 rounded-xl bg-background border-border/80"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Company Profile Filter */}
          <div className="min-w-[180px]">
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="h-10 rounded-xl bg-background border-border/80 font-medium">
                <div className="flex items-center gap-2 truncate">
                  <Building2 className="h-4 w-4 text-indigo-500 shrink-0" />
                  <SelectValue placeholder="All Companies" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All Companies ({invoices.length})
                </SelectItem>
                {companyProfiles.map(p => {
                  const count = invoices.filter(inv => inv.companyProfileId === p.id).length;
                  return (
                    <SelectItem key={p.id} value={p.id!}>
                      {p.name} ({count})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="min-w-[140px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 rounded-xl bg-background border-border/80 font-medium">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Sent">Sent</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
                <SelectItem value="Refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-10 px-3 text-muted-foreground hover:text-foreground rounded-xl shrink-0"
            >
              <X className="mr-1.5 h-3.5 w-3.5" /> Clear Filters
            </Button>
          )}
        </div>

        {/* Counter Badge */}
        <div className="text-xs font-semibold text-muted-foreground shrink-0 self-center">
          Showing {filteredInvoices.length} of {invoices.length}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="border rounded-2xl overflow-hidden shadow-sm bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold">Invoice ID</TableHead>
              <TableHead className="font-bold">Client</TableHead>
              <TableHead className="font-bold">Company Profile</TableHead>
              <TableHead className="font-bold">Date</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold text-right">Total</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No invoices match your selected filters.</p>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" onClick={resetFilters} className="mt-1 rounded-xl">
                        Reset Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="font-bold text-foreground">
                    <span className="font-mono text-sm px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">
                      {invoice.invoiceId}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-foreground">{invoice.clientName}</div>
                    {invoice.companyName && (
                      <div className="text-xs text-muted-foreground">{invoice.companyName}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-medium bg-background text-foreground/80 border-border">
                      {getProfileName(invoice.companyProfileId)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm font-medium">
                    {format(new Date(invoice.date), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('border-transparent font-semibold shadow-none text-xs px-2.5 py-0.5', getStatusClass(invoice.status))}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-black text-sm">
                    £{invoice.totalAmount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl shadow-lg border-border">
                        <DropdownMenuItem onSelect={() => onView(invoice)} className="cursor-pointer">
                          <Eye className="mr-2 h-4 w-4 text-indigo-500" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onEdit(invoice)} className="cursor-pointer">
                          <Edit className="mr-2 h-4 w-4 text-amber-500" /> Edit
                        </DropdownMenuItem>
                        {invoice.status !== 'Paid' && (
                          <DropdownMenuItem onSelect={() => handleSetStatus(invoice.id!, 'Paid')} disabled={isUpdating} className="cursor-pointer text-emerald-600 focus:text-emerald-600">
                            <CheckCircle className="mr-2 h-4 w-4" /> Mark as Paid
                          </DropdownMenuItem>
                        )}
                        {invoice.status !== 'Partially Paid' && (
                          <DropdownMenuItem onSelect={() => handleSetStatus(invoice.id!, 'Partially Paid')} disabled={isUpdating} className="cursor-pointer text-amber-600 focus:text-amber-600">
                            <CheckCircle className="mr-2 h-4 w-4" /> Mark as Partially Paid
                          </DropdownMenuItem>
                        )}
                        {invoice.status !== 'Overdue' && (
                          <DropdownMenuItem onSelect={() => handleSetStatus(invoice.id!, 'Overdue')} disabled={isUpdating} className="cursor-pointer text-rose-600 focus:text-rose-600">
                            <CheckCircle className="mr-2 h-4 w-4" /> Mark as Overdue
                          </DropdownMenuItem>
                        )}
                        {invoice.status !== 'Refunded' && (
                          <DropdownMenuItem onSelect={() => handleSetStatus(invoice.id!, 'Refunded')} disabled={isUpdating} className="cursor-pointer text-purple-600 focus:text-purple-600">
                            <CheckCircle className="mr-2 h-4 w-4" /> Mark as Refunded
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => onDelete(invoice)} className="cursor-pointer text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

    