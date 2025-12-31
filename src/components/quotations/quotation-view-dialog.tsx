
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QuotationView } from './quotation-view';
import type { Quotation } from '@/lib/types';
import { Printer, Download, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type QuotationViewDialogProps = {
  quotation: Quotation | null;
  isOpen: boolean;
  onClose: () => void;
};

export function QuotationViewDialog({ quotation, isOpen, onClose }: QuotationViewDialogProps) {
  const viewRef = React.useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handlePrint = () => {
    if (!viewRef.current) return;
    const printContent = viewRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'height=800,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Print Quotation</title>');
      printWindow.document.write('<style>@media print { @page { size: A4; margin: 0; } body { margin: 1.5cm; } } body { font-family: sans-serif; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid black; padding: 8px; text-align: left; } .grid { display: grid; } .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); } .gap-4 { gap: 1rem; } .mt-4 { margin-top: 1rem; } .p-2 { padding: 0.5rem; } .border { border: 1px solid black; } .font-bold { font-weight: bold; } .text-right { text-align: right; } .text-center { text-align: center; } .text-xs { font-size: 0.75rem; } .text-sm { font-size: 0.875rem; } .whitespace-pre-wrap { white-space: pre-wrap; } .min-h-\\[80px\\] { min-height: 80px; } .justify-between { justify-content: space-between; } .items-start { align-items: flex-start; } .items-center { align-items: center; } .pb-4 { padding-bottom: 1rem; } .border-b-2 { border-bottom-width: 2px; } .w-1\\/3 { width: 33.333333%; } .flex { display: flex; } .bg-gray-200 { background-color: #E5E7EB; } .w-\\[60\\%\\] { width: 60%; } .h-8 { height: 2rem; } .min-h-\\[297mm\\] { min-height: 297mm; } .mx-auto { margin-left: auto; margin-right: auto; } .w-\\[210mm\\] { width: 210mm; } .p-8 { padding: 2rem; } .border-black { border-color: #000; } .border-2 { border-width: 2px; } .text-lg { font-size: 1.125rem; } .text-2xl { font-size: 1.5rem; } .font-semibold { font-weight: 600; } .mb-1 { margin-bottom: 0.25rem; } .align-top { vertical-align: top; } .pt-1 { padding-top: 0.25rem; } .text-\\[10px\\] { font-size: 10px; } </style>');
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
    if (!viewRef.current || !quotation) return;
    setIsSaving(true);
    
    const canvas = await html2canvas(viewRef.current, { 
      scale: 2, 
      useCORS: true,
      backgroundColor: '#ffffff'
    });
    
    // Use JPEG with quality setting to reduce file size
    const imgData = canvas.toDataURL('image/jpeg', 0.7);
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Quotation-${quotation.quotationId}.pdf`);

    setIsSaving(false);
  };

  if (!quotation) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Quotation Details - {quotation.quotationId}</DialogTitle>
        </DialogHeader>
        <div className="py-4 bg-gray-200 overflow-y-auto max-h-[70vh]">
            <div ref={viewRef}>
              <QuotationView quotation={quotation} />
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
