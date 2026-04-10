
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InvoiceView } from './invoice-view';
import type { Invoice, CompanyProfile } from '@/lib/types';
import { Printer, Download, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type InvoiceViewDialogProps = {
  invoice: Invoice | null;
  companyProfiles: CompanyProfile[];
  isOpen: boolean;
  onClose: () => void;
};

export function InvoiceViewDialog({ invoice, companyProfiles, isOpen, onClose }: InvoiceViewDialogProps) {
  const viewRef = React.useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  const getCompanyProfile = (id: string) => companyProfiles.find(p => p.id === id);

  const handlePrint = () => {
    if (!viewRef.current) return;
    const printContent = viewRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'height=800,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Print Invoice</title>');
      // A more comprehensive style block for better print fidelity
      printWindow.document.write(`<style>
        @media print { 
            @page { size: A4; margin: 0; } 
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        } 
        body { font-family: sans-serif; }
        .invoice-view { width: 210mm; min-height: 297mm; margin: auto; padding: 2rem; background: white; color: black; }
        .grid { display: grid; } .gap-4 { gap: 1rem; } .gap-8 { gap: 2rem; } .mt-8 { margin-top: 2rem; } .mb-8 { margin-bottom: 2rem; }
        .flex { display: flex; } .justify-between { justify-content: space-between; } .items-start { align-items: flex-start; } .flex-col { flex-direction: column; }
        .text-right { text-align: right; } .text-sm { font-size: 0.875rem; } .text-xs { font-size: 0.75rem; } .text-lg { font-size: 1.125rem; } .text-2xl { font-size: 1.5rem; } .text-4xl { font-size: 2.25rem; }
        .font-bold { font-weight: 700; } .font-light { font-weight: 300; }
        .text-muted-foreground { color: #64748b; }
        .border-b { border-bottom-width: 1px; } .border-t { border-top-width: 1px; } .border-black { border-color: #000; } .pb-8 { padding-bottom: 2rem; }
        .whitespace-pre-wrap { white-space: pre-wrap; }
        table { width: 100%; border-collapse: collapse; } th { text-align: left; }
        thead th { border-bottom: 1px solid #000; padding: 0.5rem 0; }
        tbody tr td { border-bottom: 1px solid #e5e7eb; padding: 0.5rem 0; }
        tbody tr:last-child td { border-bottom: none; }
        .w-1\\/2 { width: 50%; } .w-full { width: 100%; }
        img { max-width: 150px; }
      </style>`);
      printWindow.document.write('</head><body>');
      printWindow.document.write(printContent);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };
  
  const handleSavePdf = async () => {
    if (!viewRef.current || !invoice) return;
    setIsSaving(true);
    
    const canvas = await html2canvas(viewRef.current, { 
      scale: 2, 
      useCORS: true,
      backgroundColor: '#ffffff'
    });
    
    const imgData = canvas.toDataURL('image/jpeg', 0.8);
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Invoice-${invoice.invoiceId}.pdf`);

    setIsSaving(false);
  };

  if (!invoice) return null;

  const companyProfile = getCompanyProfile(invoice.companyProfileId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Invoice - {invoice.invoiceId}</DialogTitle>
        </DialogHeader>
        <div className="py-4 bg-gray-200 overflow-y-auto max-h-[70vh]">
            <div ref={viewRef}>
              <InvoiceView invoice={invoice} companyProfile={companyProfile} />
            </div>
        </div>
        <DialogFooter className="sm:flex-row sm:justify-center gap-2">
          <Button type="button" onClick={handlePrint} className="flex-1">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button type="button" variant="secondary" onClick={handleSavePdf} disabled={isSaving} className="flex-1">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Save as PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    