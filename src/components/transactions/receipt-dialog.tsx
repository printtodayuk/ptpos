'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PrintReceipt } from './print-receipt';
import type { Transaction } from '@/lib/types';
import { Printer, Download, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type ReceiptDialogProps = {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
};

export function ReceiptDialog({ transaction, isOpen, onClose }: ReceiptDialogProps) {
  const receiptRef = React.useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handlePrint = () => {
    if (!receiptRef.current) return;

    const receiptHtml = receiptRef.current.innerHTML;
    
    // Create an iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      // Inject necessary styles for printing
      // This includes Tailwind-like classes used in PrintReceipt
      iframeDoc.write(`
        <html>
          <head>
            <title>Print Receipt</title>
            <style>
              @media print {
                @page { 
                  margin: 0; 
                  size: 80mm auto;
                }
                body { 
                  margin: 0; 
                  -webkit-print-color-adjust: exact;
                }
              }
              body {
                font-family: monospace;
              }
              .font-mono { font-family: monospace; }
              .text-xs { font-size: 0.75rem; line-height: 1rem; }
              .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
              .text-base { font-size: 1rem; line-height: 1.5rem; }
              .text-black { color: #000; }
              .bg-white { background-color: #fff; }
              .p-2 { padding: 0.5rem; }
              .w-[280px] { width: 280px; }
              .text-center { text-align: center; }
              .mb-2 { margin-bottom: 0.5rem; }
              .font-bold { font-weight: 700; }
              .my-2 { margin-top: 0.5rem; margin-bottom: 0.5rem; }
              .border-dashed { border-style: dashed; }
              .border-solid { border-style: solid; }
              .border-black { border-color: #000; }
              hr { border-top-width: 1px; }
              .space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.25rem; }
              .flex { display: flex; }
              .justify-between { justify-content: space-between; }
              .text-right { text-align: right; }
              .whitespace-pre-wrap { white-space: pre-wrap; }
              .mt-1 { margin-top: 0.25rem; }
              .mt-2 { margin-top: 0.5rem; }
              .pt-1 { padding-top: 0.25rem; }
              .text-\\[10px\\] { font-size: 10px; }
              img { max-width: 100%; height: auto; }
              .mx-auto { margin-left: auto; margin-right: auto; }
            </style>
          </head>
          <body>
            ${receiptHtml}
          </body>
        </html>
      `);
      iframeDoc.close();
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };
  
  const handleSavePdf = async () => {
    if (!receiptRef.current || !transaction) return;
    setIsSaving(true);

    const canvas = await html2canvas(receiptRef.current, {
      scale: 2, // A lower scale is fine for PDF
      backgroundColor: '#ffffff',
      useCORS: true, // Important for external images
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.7); // Use JPEG with quality 0.7
    
    // A standard 80mm thermal paper receipt is about 80mm wide.
    // The height will be dynamic.
    const pdfWidth = 80; 
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfWidth, pdfHeight]
    });
    
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Receipt-${transaction.transactionId}.pdf`);

    setIsSaving(false);
  };

  if (!transaction) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transaction Receipt</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center py-4">
          <div className="p-4 border rounded-lg bg-gray-50">
            <div ref={receiptRef}>
              <PrintReceipt transaction={transaction} />
            </div>
          </div>
        </div>
        <DialogFooter className="sm:flex-row sm:justify-center gap-2">
          <Button type="button" onClick={handlePrint} className="flex-1">
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleSavePdf}
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Save as PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
