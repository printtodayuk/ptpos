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
import { Printer } from 'lucide-react';
import React from 'react';

type ReceiptDialogProps = {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
};

export function ReceiptDialog({ transaction, isOpen, onClose }: ReceiptDialogProps) {
  const receiptRef = React.useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!receiptRef.current) return;

    const receiptHtml = receiptRef.current.innerHTML;
    
    // Create an iframe
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
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
              .font-mono { font-family: monospace; }
              .text-xs { font-size: 0.75rem; }
              .text-sm { font-size: 0.875rem; }
              .text-base { font-size: 1rem; }
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
              .text-[10px] { font-size: 10px; }
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

  if (!transaction) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transaction Added</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center py-4">
          <div className="p-4 border rounded-lg bg-gray-50" ref={receiptRef}>
            <PrintReceipt transaction={transaction} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handlePrint} className="w-full">
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
