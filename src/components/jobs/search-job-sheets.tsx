'use client';
import { useState, useTransition, useEffect, useCallback } from 'react';
import { searchJobSheets, deleteJobSheet } from '@/lib/server-actions-jobs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import type { JobSheet } from '@/lib/types';
import { useDebounce } from '@/hooks/use-debounce';
import { JobSheetForm } from './job-sheet-form';
import { JobSheetsTable } from './job-sheets-table';
import { JobSheetViewDialog } from './job-sheet-view-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

type SearchJobSheetsProps = {
  onJobSheetUpdated: () => void;
};

export function SearchJobSheets({ onJobSheetUpdated }: SearchJobSheetsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<JobSheet[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const [jobSheetToEdit, setJobSheetToEdit] = useState<JobSheet | null>(null);
  const [jobSheetToView, setJobSheetToView] = useState<JobSheet | null>(null);
  const [jobSheetToDelete, setJobSheetToDelete] = useState<JobSheet | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
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

  const handleDeleteRequest = (jobSheet: JobSheet) => {
    setJobSheetToDelete(jobSheet);
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

  const handleUpdate = () => {
    setIsEditDialogOpen(false);
    setJobSheetToEdit(null);
    onJobSheetUpdated();
    performSearch(debouncedSearchTerm);
  };

  return (
    <>
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Job Sheet</DialogTitle>
          </DialogHeader>
          <div className="py-4">
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

       <AlertDialog open={!!jobSheetToDelete} onOpenChange={() => setJobSheetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the job sheet
              with ID <span className="font-bold">{jobSheetToDelete?.jobId}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
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
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
