
'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { searchQuotations, exportAllQuotations, deleteQuotation } from '@/lib/server-actions-quotations';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Download } from 'lucide-react';
import type { Quotation, QuotationStatus, Operator } from '@/lib/types';
import { quotationStatus, operators } from '@/lib/types';
import { useDebounce } from '@/hooks/use-debounce';
import { QuotationsTable } from './quotations-table';
import { QuotationForm } from './quotation-form';
import { QuotationViewDialog } from './quotation-view-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { exportToCsv } from '@/lib/utils';
import { Label } from '../ui/label';
import { QuotationHistoryDialog } from './quotation-history-dialog';

const DELETE_PIN = '5206';

export function QuotationReportClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [quotationStatusFilter, setQuotationStatusFilter] = useState<QuotationStatus | 'all'>('all');
  const [operatorFilter, setOperatorFilter] = useState<Operator | 'all'>('all');
  const [results, setResults] = useState<Quotation[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const [isExporting, startExportTransition] = useTransition();
  const [quotationToEdit, setQuotationToEdit] = useState<Quotation | null>(null);
  const [quotationToView, setQuotationToView] = useState<Quotation | null>(null);
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);
  const [quotationToViewHistory, setQuotationToViewHistory] = useState<Quotation | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [pin, setPin] = useState('');


  const { toast } = useToast();
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const performSearch = useCallback((term: string, quotationStatus: QuotationStatus | 'all', operator: Operator | 'all') => {
    startSearchTransition(async () => {
      const allResults = await searchQuotations(
        term, 
        true, 
        quotationStatus === 'all' ? undefined : quotationStatus,
        operator === 'all' ? undefined : operator
      );
      setResults(allResults);
    });
  }, []);

  useEffect(() => {
    performSearch(debouncedSearchTerm, quotationStatusFilter, operatorFilter);
  }, [debouncedSearchTerm, quotationStatusFilter, operatorFilter, performSearch]);

  const handleExport = () => {
    startExportTransition(async () => {
      if (results.length === 0) {
        toast({ variant: 'destructive', title: 'Nothing to Export', description: 'No quotations match the current filters.' });
        return;
      }
      
      const dataToExport = await exportAllQuotations(
          debouncedSearchTerm,
          quotationStatusFilter === 'all' ? undefined : quotationStatusFilter,
          operatorFilter === 'all' ? undefined : operatorFilter
      );

      if (dataToExport.length > 0) {
        exportToCsv(`quotations-report_${new Date().toISOString().split('T')[0]}.csv`, dataToExport);
        toast({ title: 'Success', description: 'Quotations exported successfully.' });
      } else {
        toast({ variant: 'destructive', title: 'Nothing to Export', description: 'No quotations found to export.' });
      }
    });
  };

  const handleEdit = (quotation: Quotation) => {
    setQuotationToEdit(quotation);
    setIsEditDialogOpen(true);
  };
  
  const handleView = (quotation: Quotation) => {
    setQuotationToView(quotation);
  };

  const handleViewHistory = (quotation: Quotation) => {
    setQuotationToViewHistory(quotation);
  };

  const handleDeleteRequest = (quotation: Quotation) => {
    setQuotationToDelete(quotation);
    setIsPinDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!quotationToDelete) return;
    setIsDeleting(true);
    const result = await deleteQuotation(quotationToDelete.id!);
    setIsDeleting(false);
    if (result.success) {
      toast({ title: 'Success', description: 'Quotation deleted.' });
      performSearch(debouncedSearchTerm, quotationStatusFilter, operatorFilter);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setQuotationToDelete(null);
  };
  
  const handlePinSubmit = () => {
    if (pin !== DELETE_PIN) {
        toast({ variant: 'destructive', title: 'Incorrect PIN', description: 'The PIN you entered is incorrect.' });
        setPin('');
        return;
    }
    setIsPinDialogOpen(false);
    setPin('');
    confirmDelete();
  };

  const handleUpdate = () => {
    setIsEditDialogOpen(false);
    setQuotationToEdit(null);
    performSearch(debouncedSearchTerm, quotationStatusFilter, operatorFilter);
  };
  
  const quotationStatusFilters: (QuotationStatus | 'all')[] = ['all', ...quotationStatus];
  const operatorFilters: (Operator | 'all')[] = ['all', ...operators];


  return (
    <>
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-4xl p-0 flex flex-col h-full max-h-[90vh]">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>Edit Quotation {quotationToEdit?.quotationId}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
             <QuotationForm
                onQuotationAdded={handleUpdate}
                quotationToEdit={quotationToEdit}
              />
          </div>
        </DialogContent>
      </Dialog>

      <QuotationViewDialog
        quotation={quotationToView}
        isOpen={!!quotationToView}
        onClose={() => setQuotationToView(null)}
      />

       <QuotationHistoryDialog
        quotation={quotationToViewHistory}
        isOpen={!!quotationToViewHistory}
        onClose={() => setQuotationToViewHistory(null)}
      />

       <Dialog open={isPinDialogOpen} onOpenChange={(open) => { if(!open) { setQuotationToDelete(null); setPin(''); } setIsPinDialogOpen(open);}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter PIN to Delete Quotation</DialogTitle>
            <DialogDescription>
              To delete quotation <span className="font-bold">{quotationToDelete?.quotationId}</span>, please enter the admin PIN.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="pin">Admin PIN</Label>
            <Input 
              id="pin" 
              type="password" 
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsPinDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePinSubmit} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by Quotation ID, client name, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10"
              />
            </div>
            <Button onClick={handleExport} disabled={isExporting} variant="outline" className="w-full sm:w-auto">
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export as CSV
            </Button>
          </div>
          
          <div className="flex flex-col gap-4">
             <div>
                <span className="text-sm font-medium text-muted-foreground mr-2">Operator:</span>
                <div className="flex flex-wrap items-center gap-2">
                    {operatorFilters.map(op => (
                    <Button
                        key={op}
                        variant={operatorFilter === op ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setOperatorFilter(op)}
                        className="capitalize"
                    >
                        {op}
                    </Button>
                    ))}
                </div>
            </div>
             <div>
                <span className="text-sm font-medium text-muted-foreground mr-2">Status:</span>
                <div className="flex flex-wrap items-center gap-2">
                    {quotationStatusFilters.map(status => (
                    <Button
                        key={status}
                        variant={quotationStatusFilter === status ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setQuotationStatusFilter(status)}
                        className="capitalize"
                    >
                        {status}
                    </Button>
                    ))}
                </div>
            </div>
          </div>

          {isSearching ? (
            <div className="flex justify-center items-center p-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <QuotationsTable
              quotations={results}
              onEdit={handleEdit}
              onView={handleView}
              onDelete={handleDeleteRequest}
              onViewHistory={handleViewHistory}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
