'use client';
import { useState, useTransition, useEffect, useCallback } from 'react';
import { searchJobSheets, deleteJobSheet, addTransactionFromJobSheet } from '@/lib/server-actions-jobs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import type { JobSheet } from '@/lib/types';
import { useDebounce } from '@/hooks/use-debounce';
import { JobSheetForm } from './job-sheet-form';
import { JobSheetsTable } from './job-sheets-table';
import { JobSheetViewDialog } from './job-sheet-view-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { PaymentDialog } from './payment-dialog';
import { ReceiptDialog } from '../transactions/receipt-dialog';
import type { Transaction } from '@/lib/types';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

const DELETE_PIN = '5206';

type SearchJobSheetsProps = {
  onJobSheetUpdated: () => void;
};

export function SearchJobSheets({ onJobSheetUpdated }: SearchJobSheetsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<JobSheet[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
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

  const performSearch = useCallback((term: string) => {
    startSearchTransition(async () => {
      const allResults = await searchJobSheets(term);
      setResults(allResults);
    });
  }, []);

  useEffect(() => {
    performSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, performSearch]);

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
      performSearch(debouncedSearchTerm);
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
    onJobSheetUpdated();
    performSearch(debouncedSearchTerm);
  };

  const handlePaymentSuccess = (transaction: Transaction) => {
    setJobSheetToPay(null);
    setLastTransaction(transaction);
    toast({ title: 'Success', description: `Payment recorded. Transaction ID: ${transaction.transactionId}` });
    performSearch(debouncedSearchTerm);
  }

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
        <CardHeader>
          <CardTitle>Search Job Sheets</CardTitle>
          <CardDescription>
            Search by Job ID, client name, or job description.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="e.g. JID0001, John Doe, Flyer Design..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
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
