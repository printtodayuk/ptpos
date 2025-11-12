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
import { Printer, Edit } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type ReceiptDialogProps = {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
};

export function ReceiptDialog({ transaction, isOpen, onClose }: ReceiptDialogProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  if (!transaction) {
    return null;
  }

  // Create a portal for the printable receipt to isolate its styles
  const printPortal = isMounted && isPrinting ? createPortal(
    <div className="print-only">
      <style>
        {`
          @media print {
            body > *:not(.print-only) {
              display: none !important;
            }
            .print-only {
              display: block !important;
              position: absolute;
              top: 0;
              left: 0;
            }
          }
        `}
      </style>
      <PrintReceipt transaction={transaction} />
    </div>,
    document.body
  ) : null;

  return (
    <>
      {printPortal}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md print-hide">
          <DialogHeader>
            <DialogTitle>Transaction Added</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-4">
             <div className="p-4 border rounded-lg bg-gray-50">
                <PrintReceipt transaction={transaction} />
            </div>
          </div>
          <DialogFooter className="sm:justify-between gap-2">
             <Button type="button" variant="outline" onClick={onClose}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
            </Button>
            <Button type="button" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
