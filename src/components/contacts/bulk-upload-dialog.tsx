'use client';

import { useState, useTransition } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { bulkAddContacts } from '@/lib/server-actions-contacts';

export function BulkUploadDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [importStats, setImportStats] = useState<{ total: number } | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setImportStats(null);
    }
  };

  const processUpload = async () => {
    if (!file) return;

    startTransition(async () => {
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast({ variant: 'destructive', title: 'Empty File', description: 'The uploaded file contains no data.' });
          return;
        }

        // Map Excel headers to our schema
        const contactsToImport = jsonData.map((row: any) => {
          const streetLines = [
            row['Address Line1'],
            row['Address Line2'],
            row['Address Line3']
          ].filter(Boolean);

          return {
            name: String(row['Name'] || '').trim(),
            companyName: String(row['Company Name'] || '').trim(),
            street: streetLines.join('\n'),
            city: String(row['City'] || '').trim(),
            state: String(row['State'] || '').trim(),
            zip: String(row['Zip code'] || '').trim(),
            phone: String(row['Phone'] || '').trim(),
            email: String(row['Email'] || '').trim(),
          };
        }).filter(c => c.name && c.email); // Basic validation: must have name and email

        if (contactsToImport.length === 0) {
          toast({ 
            variant: 'destructive', 
            title: 'Invalid Format', 
            description: 'Could not find any valid contacts. Check your column headers (Name, Email, etc.).' 
          });
          return;
        }

        const result = await bulkAddContacts(contactsToImport);

        if (result.success) {
          setImportStats({ total: contactsToImport.length });
          toast({ title: 'Import Complete', description: result.message });
          // Optionally close after a delay or keep open to show stats
          setTimeout(() => {
            setIsOpen(false);
            setFile(null);
            setImportStats(null);
          }, 2000);
        } else {
          toast({ variant: 'destructive', title: 'Import Failed', description: result.message });
        }
      } catch (error) {
        console.error('File processing error:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to process Excel file. Ensure it is a valid .xlsx or .xls file.' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary/20 hover:bg-primary/5">
          <Upload className="mr-2 h-4 w-4" />
          Bulk Import (Excel)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Bulk Upload Contacts</DialogTitle>
          <DialogDescription>
            Upload an Excel file to import multiple contacts. 
            The file should have headers like Name, Company Name, Address Line1, Phone, Email, etc.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {!importStats ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-primary/20 rounded-xl p-8 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <FileSpreadsheet className="h-12 w-12 text-primary/40 mb-4" />
              <p className="text-sm font-medium text-center">
                {file ? file.name : "Click or drag to select .xlsx or .xls file"}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Supported: Name, Company Name, Address Line1-3, City, State, Zip, Phone, Email
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div className="text-center">
                <p className="text-lg font-bold">Import Successful!</p>
                <p className="text-sm text-muted-foreground">{importStats.total} contacts added to your list.</p>
              </div>
            </div>
          )}

          {file && !importStats && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Ensure your column names match: <strong>Name, Company Name, Address Line1, Address Line2, Address Line3, City, State, Zip code, Phone, Email</strong>.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={processUpload} disabled={!file || isPending || !!importStats} className="bg-primary hover:bg-primary/90 text-white">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Start Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
