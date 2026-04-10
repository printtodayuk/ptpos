'use client';

import type { JobSheet } from '@/lib/types';
import { format } from 'date-fns';
import Image from 'next/image';

type DeliveryNoteViewProps = {
  jobSheet: JobSheet;
};

export function DeliveryNoteView({ jobSheet }: DeliveryNoteViewProps) {
  if (!jobSheet) return null;

  return (
    <div 
      id="delivery-note-to-print" 
      className="font-sans text-xs text-black bg-white p-4 w-[4in] h-[6in] border border-black flex flex-col justify-between"
    >
      <div>
        {/* Header */}
        <div className="flex justify-between items-start pb-2 border-b border-black mb-2">
           <div className="w-1/2">
             <Image 
              src="https://ssl.prcdn.com/uk/branddemand/T1Q/Logo%20for%20Signature.png?1700078679"
              alt="Print Today Logo"
              width={120}
              height={40}
            />
          </div>
          <div className="w-1/2 text-right text-[10px]">
              <p>75 Green Street, London E7 8JF</p>
              <p>07969559746</p>
              <p>info@printtodayuk.com</p>
          </div>
        </div>

        <div className="flex justify-between items-start pb-2 border-b border-black mb-2">
          <div>
            <p className="font-bold text-sm">DELIVERY NOTE</p>
            <p><strong>Job No:</strong> <span className="font-bold">{jobSheet.jobId}</span></p>
          </div>
          <div className="text-right">
              <strong>Delivery By:</strong> 
              <p>{jobSheet.deliveryBy ? format(new Date(jobSheet.deliveryBy), 'dd/MM/yyyy') : 'N/A'}</p>
          </div>
        </div>
        
        {/* Client Info */}
        <div className="space-y-2 text-sm">
          <h2 className="font-bold">SHIP TO:</h2>
          <div className="pl-2">
            <p className="font-semibold">{jobSheet.clientName}</p>
            <p className="whitespace-pre-wrap">{jobSheet.clientDetails}</p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div>
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black p-1 text-left">DESCRIPTION</th>
              <th className="border border-black p-1 text-right w-16">QTY</th>
            </tr>
          </thead>
          <tbody>
            {jobSheet.jobItems.map((item, index) => (
              <tr key={index}>
                <td className="border border-black p-1 align-top">{item.description}</td>
                <td className="border border-black p-1 text-right align-top">{item.quantity}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 8 - jobSheet.jobItems.length) }).map((_, index) => (
                <tr key={`empty-${index}`}>
                    <td className="border border-black p-1 h-6">&nbsp;</td>
                    <td className="border border-black p-1">&nbsp;</td>
                </tr>
            ))}
          </tbody>
        </table>
        
        {/* Footer */}
        <div className="mt-2 text-center text-[10px]">
          <p>Thank you for your business!</p>
        </div>
      </div>
    </div>
  );
}
