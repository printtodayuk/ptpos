import type { Transaction } from '@/lib/types';
import { format } from 'date-fns';

type PrintReceiptProps = {
  transaction: Transaction;
};

export function PrintReceipt({ transaction }: PrintReceiptProps) {
  if (!transaction) return null;

  return (
    <div className="font-mono text-xs text-black bg-white p-2 w-[280px]">
      <div className="text-center mb-2">
        <h1 className="text-lg font-bold">Print Today</h1>
        <p>Payment Receipt</p>
      </div>
      <hr className="border-dashed border-black my-2" />
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{format(transaction.date, 'dd/MM/yyyy HH:mm')}</span>
        </div>
        {transaction.invoiceNumber && (
          <div className="flex justify-between">
            <span>Invoice #:</span>
            <span>{transaction.invoiceNumber}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Client:</span>
          <span>{transaction.clientName}</span>
        </div>
      </div>
      <hr className="border-dashed border-black my-2" />
      {transaction.jobDescription && (
        <>
        <div className="space-y-1">
            <p>Description:</p>
            <p className="whitespace-pre-wrap">{transaction.jobDescription}</p>
        </div>
        <hr className="border-dashed border-black my-2" />
        </>
      )}
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Amount:</span>
          <span>£{transaction.amount.toFixed(2)}</span>
        </div>
        {transaction.vatApplied && (
          <div className="flex justify-between">
            <span>VAT (20%):</span>
            <span>£{(transaction.totalAmount - transaction.amount).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm">
          <span>Total:</span>
          <span>£{transaction.totalAmount.toFixed(2)}</span>
        </div>
      </div>
      <hr className="border-dashed border-black my-2" />
      <div className="space-y-1">
        <div className="flex justify-between">
            <span>Payment:</span>
            <span>{transaction.paymentMethod}</span>
        </div>
        {transaction.reference && (
            <div className="flex justify-between">
                <span>Ref:</span>
                <span>{transaction.reference}</span>
            </div>
        )}
         <div className="flex justify-between">
            <span>Operator:</span>
            <span>{transaction.operator}</span>
        </div>
      </div>
      <hr className="border-dashed border-black my-2" />
      <div className="text-center mt-2">
        <p>Thank you for your business!</p>
      </div>
    </div>
  );
}
