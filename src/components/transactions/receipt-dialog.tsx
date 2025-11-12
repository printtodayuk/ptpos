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

type ReceiptDialogProps = {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
};

export function ReceiptDialog({ transaction, isOpen, onClose }: ReceiptDialogProps) {
  
  const handlePrint = () => {
    window.print();
  };

  if (!transaction) {
    return null;
  }

  return (
    <>
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
          <DialogFooter>
            <Button type="button" onClick={handlePrint} className="w-full">
              <Printer className="mr-2 h-4 w-4" />
              Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* This is the hidden, printable version of the receipt */}
      <div className="print-only">
        <PrintReceipt transaction={transaction} />
      </div>
    </>
  );
}
