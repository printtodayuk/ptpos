
'use client';

import type { JobSheet } from '@/lib/types';
import { format } from 'date-fns';
import Image from 'next/image';

type JobSheetViewProps = {
  jobSheet: JobSheet;
  hideTotals?: boolean;
};

export function JobSheetView({ jobSheet, hideTotals = false }: JobSheetViewProps) {
  if (!jobSheet) return null;

  const jobSheetTitle = 'Purchase Order';
  const paidAmount = jobSheet.paidAmount || 0;
  const dueAmount = jobSheet.totalAmount - paidAmount;

  return (
    <div 
      id="job-sheet-to-print" 
      className="font-sans text-sm text-black bg-white p-8 w-[210mm] min-h-[297mm] mx-auto"
    >
      {/* Header */}
      <div className="flex justify-between items-start pb-4 border-b-2 border-black">
        <div className="w-1/3">
          <Image 
            src="https://ssl.prcdn.com/uk/branddemand/T1Q/Logo%20for%20Signature.png?1700078679"
            alt="Print Today Logo"
            width={200}
            height={60}
          />
        </div>
        <div className="w-1/3 text-center">
            <h1 className="text-2xl font-bold">{jobSheetTitle}</h1>
        </div>
        <div className="w-1/3 text-right text-xs">
            <p>75 Green Street, London E7 8JF</p>
            <p>07969559746</p>
            <p>info@printtodayuk.com</p>
            <p>www.printtodayuk.com</p>
        </div>
      </div>

      {/* Job Info */}
       <div className="grid grid-cols-3 gap-4 mt-4 text-xs">
        <div className="border border-black p-2">
            <strong>Job No:</strong> <span className="font-bold">{jobSheet.jobId}</span>
        </div>
        <div className="border border-black p-2">
            <strong>Date:</strong> {format(new Date(jobSheet.date), 'dd/MM/yyyy')}
        </div>
        <div className="border border-black p-2">
            <strong>IR No:</strong> {jobSheet.irNumber}
        </div>
        <div className="border border-black p-2">
            <strong>Operator:</strong> {jobSheet.operator}
        </div>
         <div className="border border-black p-2">
            <strong>Delivery By:</strong> {jobSheet.deliveryBy ? format(new Date(jobSheet.deliveryBy), 'dd/MM/yyyy') : 'N/A'}
        </div>
      </div>
      
      {/* Client Info */}
      <div className="mt-4 border border-black p-2 text-xs">
        <h2 className="font-bold mb-1">Bill To:</h2>
        <p className="font-semibold text-sm">{jobSheet.clientName}</p>
        <p className="whitespace-pre-wrap">{jobSheet.clientDetails}</p>
      </div>

      {/* Items Table */}
      <div className="mt-4">
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black p-2 text-left w-[60%]">DESCRIPTION</th>
              <th className="border border-black p-2 text-right">QTY</th>
              {!hideTotals && (
                <>
                  <th className="border border-black p-2 text-right">PRICE</th>
                  <th className="border border-black p-2 text-right">AMOUNT</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {jobSheet.jobItems.map((item, index) => (
              <tr key={index}>
                <td className="border border-black p-2 align-top">{item.description}</td>
                <td className="border border-black p-2 text-right align-top">{item.quantity}</td>
                {!hideTotals && (
                    <>
                        <td className="border border-black p-2 text-right align-top">£{item.price.toFixed(2)}</td>
                        <td className="border border-black p-2 text-right align-top">£{item.price.toFixed(2)}</td>
                    </>
                )}
              </tr>
            ))}
             {/* Add empty rows to fill space */}
            {Array.from({ length: Math.max(0, 10 - jobSheet.jobItems.length) }).map((_, index) => (
                <tr key={`empty-${index}`}>
                    <td className="border border-black p-2 h-8">&nbsp;</td>
                    <td className="border border-black p-2">&nbsp;</td>
                    {!hideTotals && (
                        <>
                            <td className="border border-black p-2">&nbsp;</td>
                            <td className="border border-black p-2">&nbsp;</td>
                        </>
                    )}
                </tr>
            ))}
          </tbody>
        </table>
      </div>

       {/* Totals and Special Notes */}
      <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
        {!hideTotals && (
            <div className="border border-black p-2">
                <h3 className="font-bold mb-1">SPECIAL NOTE</h3>
                <p className="whitespace-pre-wrap min-h-[80px]">{jobSheet.specialNote}</p>
            </div>
        )}
        {!hideTotals && (
          <div className="flex flex-col gap-px">
              <div className="flex justify-between items-center p-2 border border-black">
                  <span>Sub Total:</span>
                  <span className="font-bold">£{jobSheet.subTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2 border border-black">
                  <span>VAT (20%):</span>
                  <span className="font-bold">£{jobSheet.vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2 border-2 border-black text-sm">
                  <span className="font-bold">Total:</span>
                  <span className="font-bold">£{jobSheet.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2 border border-black">
                  <span>Amount Paid:</span>
                  <span className="font-bold">£{paidAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2 border-2 border-black bg-gray-200 text-sm">
                  <span className="font-bold">Amount Due:</span>
                  <span className="font-bold">£{dueAmount.toFixed(2)}</span>
              </div>
          </div>
        )}
         {hideTotals && (
            <div className="col-span-2 text-center text-muted-foreground">
                Internal Production Copy - Not for customer
            </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="mt-4 text-center text-xs">
        <p>Thank you for your business!</p>
        <p className="text-[10px] pt-1">Powered by Today AI</p>
        <p className="text-[10px]">Developed by Faz | RemotizedIT</p>
      </div>

    </div>
  );
}
