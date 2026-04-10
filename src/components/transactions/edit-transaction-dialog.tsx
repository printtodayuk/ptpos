'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { type Transaction } from '@/lib/types';
import { updateTransaction } from '@/lib/server-actions';
import { TransactionForm } from './transaction-form';


type EditTransactionDialogProps = {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function EditTransactionDialog({ transaction, isOpen, onClose, onSuccess }: EditTransactionDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();


  const handleUpdateSuccess = () => {
    toast({ title: 'Success', description: 'Transaction updated successfully.' });
    onSuccess();
    onClose();
  }

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl p-0 flex flex-col h-full max-h-[90vh]">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Edit Transaction {transaction.transactionId}</DialogTitle>
          <DialogDescription>
            Make changes to the transaction below.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
            <TransactionForm
                type={transaction.type}
                transactionToEdit={transaction}
                onTransactionAdded={handleUpdateSuccess}
             />
        </div>
      </DialogContent>
    </Dialog>
  );
}
