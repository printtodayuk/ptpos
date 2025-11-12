import type { Transaction } from '@/lib/types';
import { format } from 'date-fns';

type PrintReceiptProps = {
  transaction: Transaction;
};

export function PrintReceipt({ transaction }: PrintReceiptProps) {
  if (!transaction) return null;

  // These styles are optimized for a standard 80mm thermal receipt printer.
  return (
    <div 
      id="receipt-to-print" 
      className="font-mono text-xs text-black bg-white p-2 w-[280px]"
    >
      <div className="text-center mb-2">
        <h1 className="text-base font-bold">Print Today</h1>
        <p className="text-xs">Payment Receipt</p>
      </div>
      <hr className="border-dashed border-black my-2" />
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>TID:</span>
          <span>{transaction.transactionId}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{format(new Date(transaction.date), 'dd/MM/yy HH:mm')}</span>
        </div>
        {transaction.invoiceNumber && (
          <div className="flex justify-between">
            <span>Invoice #:</span>
            <span>{transaction.invoiceNumber}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Client:</span>
          <span className="text-right">{transaction.clientName}</span>
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
        <div className="flex justify-between font-bold text-sm mt-1">
          <span>Total:</span>
          <span>£{transaction.totalAmount.toFixed(2)}</span>
        </div>
      </div>
      <hr className="border-solid border-black my-2" />
       <div className="space-y-1">
        <div className="flex justify-between">
          <span>Paid Amount:</span>
          <span>£{transaction.paidAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Due Amount:</span>
          <span>£{transaction.dueAmount.toFixed(2)}</span>
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
                <span className="text-right">{transaction.reference}</span>
            </div>
        )}
         <div className="flex justify-between">
            <span>Operator:</span>
            <span>{transaction.operator}</span>
        </div>
      </div>
      <hr className="border-dashed border-black my-2" />
      <div className="text-center mt-2">
        <p className="text-xs">Thank you for your business!</p>
        <p className="text-[10px] pt-1">www.printtoday.co.uk</p>
      </div>
    </div>
  );
}
