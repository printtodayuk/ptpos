
'use client';
import { useState, useTransition, useEffect, useCallback } from 'react';
import { searchQuotations, deleteQuotation, createJobSheetFromQuotation } from '@/lib/server-actions-quotations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import type { Quotation } from '@/lib/types';
import { useDebounce } from '@/hooks/use-debounce';
import { QuotationForm } from './quotation-form';
import { QuotationsTable } from './quotations-table';
import { QuotationViewDialog } from './quotation-view-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { QuotationHistoryDialog } from './quotation-history-dialog';
import { JobSheetForm } from '../jobs/job-sheet-form';

const DELETE_PIN = '5206';

type SearchQuotationsProps = {
  onQuotationUpdated: () => void;
};

export function SearchQuotations({ onQuotationUpdated }: SearchQuotationsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Quotation[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const [quotationToEdit, setQuotationToEdit] = useState<Quotation | null>(null);
  const [quotationToView, setQuotationToView] = useState<Quotation | null>(null);
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);
  const [quotationToViewHistory, setQuotationToViewHistory] = useState<Quotation | null>(null);
  const [quotationToConvert, setQuotationToConvert] = useState<Quotation | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [pin, setPin] = useState('');
  
  const { toast } = useToast();
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const performSearch = useCallback((term: string) => {
    startSearchTransition(async () => {
      const allResults = await searchQuotations(term);
      setResults(allResults);
    });
  }, []);

  useEffect(() => {
    performSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, performSearch]);

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

  const handleCreateJob = (quotation: Quotation) => {
    setQuotationToConvert(quotation);
  };

  const confirmDelete = async () => {
    if (!quotationToDelete) return;
    setIsDeleting(true);
    const result = await deleteQuotation(quotationToDelete.id!);
    setIsDeleting(false);
    if (result.success) {
      toast({ title: 'Success', description: 'Quotation deleted.' });
      performSearch(debouncedSearchTerm);
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
    onQuotationUpdated();
    performSearch(debouncedSearchTerm);
  };
  
  const handleConversionSuccess = () => {
    setQuotationToConvert(null);
    performSearch(debouncedSearchTerm);
    onQuotationUpdated();
  }

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
      
       <Dialog open={!!quotationToConvert} onOpenChange={() => setQuotationToConvert(null)}>
        <DialogContent className="sm:max-w-4xl p-0 flex flex-col h-full max-h-[90vh]">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>Create Job Sheet from Quotation {quotationToConvert?.quotationId}</DialogTitle>
            <DialogDescription>Review and confirm the details below to create a new job sheet.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <JobSheetForm
                onJobSheetAdded={handleConversionSuccess}
                jobSheetToCreateFromQuotation={quotationToConvert}
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
        <CardHeader>
          <CardTitle>Search Quotations</CardTitle>
          <CardDescription>
            Search by Quotation ID, client name, or item description.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="e.g. QU0001, John Doe, Flyer Design..."
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
            <QuotationsTable
              quotations={results}
              onEdit={handleEdit}
              onView={handleView}
              onDelete={handleDeleteRequest}
              onViewHistory={handleViewHistory}
              onCreateJob={handleCreateJob}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
