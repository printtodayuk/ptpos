
'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { searchJobSheets, exportAllJobSheets, deleteJobSheet } from '@/lib/server-actions-jobs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Download } from 'lucide-react';
import type { JobSheet, JobSheetStatus, PaymentStatus, Operator } from '@/lib/types';
import { jobSheetStatus, paymentStatuses, operators } from '@/lib/types';
import { useDebounce } from '@/hooks/use-debounce';
import { JobSheetsTable } from './job-sheets-table';
import { JobSheetForm } from './job-sheet-form';
import { JobSheetViewDialog } from './job-sheet-view-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { exportToCsv } from '@/lib/utils';
import { PaymentDialog } from './payment-dialog';
import { ReceiptDialog } from '../transactions/receipt-dialog';
import type { Transaction } from '@/lib/types';
import { Label } from '../ui/label';

const DELETE_PIN = '5206';

export function JsReportClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState<JobSheetStatus | 'all'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [operatorFilter, setOperatorFilter] = useState<Operator | 'all'>('all');
  const [results, setResults] = useState<JobSheet[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const [isExporting, startExportTransition] = useTransition();
  const [jobSheetToEdit, setJobSheetToEdit] = useState<JobSheet | null>(null);
  const [jobSheetToView, setJobSheetToView] = useState<JobSheet | null>(null);
  const [jobSheetToPay, setJobSheetToPay] = useState<JobSheet | null>(null);
  const [jobSheetToDelete, setJobSheetToDelete] = useState<JobSheet | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [pin, setPin] = useState('');


  const { toast } = useToast();
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const performSearch = useCallback((term: string, jobStatus: JobSheetStatus | 'all', paymentStatus: PaymentStatus | 'all', operator: Operator | 'all') => {
    startSearchTransition(async () => {
      const allResults = await searchJobSheets(
        term, 
        true, 
        jobStatus === 'all' ? undefined : jobStatus,
        paymentStatus === 'all' ? undefined : paymentStatus,
        operator === 'all' ? undefined : operator
      );
      setResults(allResults);
    });
  }, []);

  useEffect(() => {
    performSearch(debouncedSearchTerm, jobStatusFilter, paymentStatusFilter, operatorFilter);
  }, [debouncedSearchTerm, jobStatusFilter, paymentStatusFilter, operatorFilter, performSearch]);

  const handleExport = () => {
    startExportTransition(async () => {
      if (results.length === 0) {
        toast({ variant: 'destructive', title: 'Nothing to Export', description: 'No job sheets match the current filters.' });
        return;
      }
      
      const dataToExport = await exportAllJobSheets(
          debouncedSearchTerm,
          jobStatusFilter === 'all' ? undefined : jobStatusFilter,
          paymentStatusFilter === 'all' ? undefined : paymentStatusFilter,
          operatorFilter === 'all' ? undefined : operatorFilter
      );

      if (dataToExport.length > 0) {
        exportToCsv(`job-sheets-report_${new Date().toISOString().split('T')[0]}.csv`, dataToExport);
        toast({ title: 'Success', description: 'Job sheets exported successfully.' });
      } else {
        toast({ variant: 'destructive', title: 'Nothing to Export', description: 'No job sheets found to export.' });
      }
    });
  };

  const handleEdit = (jobSheet: JobSheet) => {
    setJobSheetToEdit(jobSheet);
    setIsEditDialogOpen(true);
  };
  
  const handleView = (jobSheet: JobSheet) => {
    setJobSheetToView(jobSheet);
  };
  
  const handlePay = (jobSheet: JobSheet) => {
    setJobSheetToPay(jobSheet);
  };

  const handleDeleteRequest = (jobSheet: JobSheet) => {
    setJobSheetToDelete(jobSheet);
    setIsPinDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!jobSheetToDelete) return;
    setIsDeleting(true);
    const result = await deleteJobSheet(jobSheetToDelete.id!);
    setIsDeleting(false);
    if (result.success) {
      toast({ title: 'Success', description: 'Job Sheet deleted.' });
      performSearch(debouncedSearchTerm, jobStatusFilter, paymentStatusFilter, operatorFilter);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setJobSheetToDelete(null);
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
    setJobSheetToEdit(null);
    performSearch(debouncedSearchTerm, jobStatusFilter, paymentStatusFilter, operatorFilter);
  };
  
  const handlePaymentSuccess = (transaction: Transaction) => {
    setJobSheetToPay(null);
    setLastTransaction(transaction);
    toast({ title: 'Success', description: `Payment recorded. Transaction ID: ${transaction.transactionId}` });
    performSearch(debouncedSearchTerm, jobStatusFilter, paymentStatusFilter, operatorFilter);
  };

  const jobStatusFilters: (JobSheetStatus | 'all')[] = ['all', ...jobSheetStatus];
  const paymentStatusFilters: (PaymentStatus | 'all')[] = ['all', ...paymentStatuses];
  const operatorFilters: (Operator | 'all')[] = ['all', ...operators];


  return (
    <>
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-4xl p-0 flex flex-col h-full max-h-[90vh]">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>Edit Job Sheet {jobSheetToEdit?.jobId}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
             <JobSheetForm
                onJobSheetAdded={handleUpdate}
                jobSheetToEdit={jobSheetToEdit}
              />
          </div>
        </DialogContent>
      </Dialog>

      <JobSheetViewDialog
        jobSheet={jobSheetToView}
        isOpen={!!jobSheetToView}
        onClose={() => setJobSheetToView(null)}
      />

       <PaymentDialog
        jobSheet={jobSheetToPay}
        isOpen={!!jobSheetToPay}
        onClose={() => setJobSheetToPay(null)}
        onPaymentSuccess={handlePaymentSuccess}
      />
      
      <ReceiptDialog
        transaction={lastTransaction}
        isOpen={!!lastTransaction}
        onClose={() => setLastTransaction(null)}
      />

       <Dialog open={isPinDialogOpen} onOpenChange={(open) => { if(!open) { setJobSheetToDelete(null); setPin(''); } setIsPinDialogOpen(open);}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter PIN to Delete Job Sheet</DialogTitle>
            <DialogDescription>
              To delete job sheet <span className="font-bold">{jobSheetToDelete?.jobId}</span>, please enter the admin PIN.
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
                placeholder="Search by Job ID, client name, or description..."
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
                <span className="text-sm font-medium text-muted-foreground mr-2">Job Status:</span>
                <div className="flex flex-wrap items-center gap-2">
                    {jobStatusFilters.map(status => (
                    <Button
                        key={status}
                        variant={jobStatusFilter === status ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setJobStatusFilter(status)}
                        className="capitalize"
                    >
                        {status}
                    </Button>
                    ))}
                </div>
            </div>
             <div>
                <span className="text-sm font-medium text-muted-foreground mr-2">Payment Status:</span>
                <div className="flex flex-wrap items-center gap-2">
                    {paymentStatusFilters.map(status => (
                    <Button
                        key={status}
                        variant={paymentStatusFilter === status ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPaymentStatusFilter(status)}
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
            <JobSheetsTable
              jobSheets={results}
              onEdit={handleEdit}
              onView={handleView}
              onDelete={handleDeleteRequest}
              onPay={handlePay}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
