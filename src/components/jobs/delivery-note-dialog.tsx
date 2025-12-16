
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DeliveryNoteView } from './delivery-note-view';
import type { JobSheet } from '@/lib/types';
import { Printer } from 'lucide-react';
import React from 'react';

type DeliveryNoteDialogProps = {
  jobSheet: JobSheet | null;
  isOpen: boolean;
  onClose: () => void;
};

export function DeliveryNoteDialog({ jobSheet, isOpen, onClose }: DeliveryNoteDialogProps) {
  const viewRef = React.useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!viewRef.current) return;

    const printContent = viewRef.current.innerHTML;
    
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
      iframeDoc.write(`
        <html>
          <head>
            <title>Print Delivery Note</title>
            <style>
              @media print {
                @page { 
                  size: 4in 6in; 
                  margin: 0; 
                }
                body { 
                  margin: 0;
                  -webkit-print-color-adjust: exact;
                  image-rendering: high-quality;
                }
              }
              body { font-family: sans-serif; } 
              table { width: 100%; border-collapse: collapse; } 
              th, td { border: 1px solid black; padding: 4px; text-align: left; } 
              .font-bold { font-weight: bold; } 
              .text-sm { font-size: 0.875rem; } 
              .text-xs { font-size: 0.75rem; } 
              .text-\\[10px\\] { font-size: 10px; } 
              .p-4 { padding: 1rem; } 
              .border { border: 1px solid black; } 
              .space-y-2 > * + * { margin-top: 0.5rem; } 
              .w-\\[4in\\] { width: 4in; } 
              .h-\\[6in\\] { height: 6in; } 
              .flex { display: flex; } 
              .flex-col { flex-direction: column; } 
              .justify-between { justify-content: space-between; } 
              .whitespace-pre-wrap { white-space: pre-wrap; } 
              .border-b { border-bottom-width: 1px; } 
              .pb-2 { padding-bottom: 0.5rem; } 
              .mb-2 { margin-bottom: 0.25rem; } 
              .items-start { align-items: flex-start; } 
              .w-1\\/2 { width: 50%; } 
              .text-right { text-align: right; } 
              img { max-width: 100%; height: auto; } 
              .bg-gray-200 { background-color: #E5E7EB; } 
              .align-top { vertical-align: top; }
            </style>
          </head>
          <body>
            ${printContent}
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


  if (!jobSheet) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Delivery Note - {jobSheet.jobId}</DialogTitle>
        </DialogHeader>
        <div className="py-4 bg-gray-200 flex justify-center items-center overflow-auto">
            <div ref={viewRef}>
              <DeliveryNoteView jobSheet={jobSheet} />
            </div>
        </div>
        <DialogFooter className="sm:flex-row sm:justify-center gap-2">
          <Button type="button" onClick={handlePrint} className="flex-1">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
