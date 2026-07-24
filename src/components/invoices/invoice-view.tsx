
'use client';

import { format } from 'date-fns';
import Image from 'next/image';
import type { Invoice, CompanyProfile } from '@/lib/types';

type InvoiceViewProps = {
  invoice: Invoice;
  companyProfile?: CompanyProfile | null;
};

export function InvoiceView({ invoice, companyProfile }: InvoiceViewProps) {
  if (!invoice) return null;

  return (
    <div className="invoice-view font-sans text-sm text-black bg-white p-8 w-[210mm] min-h-[297mm] mx-auto flex flex-col justify-between">
      <header>
        <div className="flex justify-between items-start mb-8">
          <div>
            {companyProfile?.logoUrl && (
              <Image src={companyProfile.logoUrl} alt={companyProfile.name} width={150} height={75} />
            )}
          </div>
          <div className="text-right">
            <h1 className="text-4xl font-bold uppercase">Invoice</h1>
            <p className="text-muted-foreground">{invoice.invoiceId}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div>
            <h2 className="font-bold mb-2">From:</h2>
            <p className="font-bold">{companyProfile?.name}</p>
            <p className="whitespace-pre-wrap">{companyProfile?.address}</p>
            {companyProfile?.email && <p>{companyProfile.email}</p>}
            {companyProfile?.website && <p>{companyProfile.website}</p>}
          </div>
          <div className="text-right">
            <h2 className="font-bold mb-2">To:</h2>
            <p className="font-bold">{invoice.clientName}</p>
            {invoice.companyName && <p className="font-semibold italic">{invoice.companyName}</p>}
            <p className="whitespace-pre-wrap">{invoice.clientAddress}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-8 mt-8">
            <div></div>
            <div className="text-right">
                <p><span className="font-bold">Date:</span> {format(new Date(invoice.date), 'PPP')}</p>
                <p><span className="font-bold">Due Date:</span> {format(new Date(invoice.dueDate), 'PPP')}</p>
            </div>
        </div>

      </header>
      
      <main className="flex-grow mt-8">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left font-bold uppercase text-xs pb-2">Description</th>
              <th className="text-right font-bold uppercase text-xs pb-2">Qty</th>
              <th className="text-right font-bold uppercase text-xs pb-2">Price</th>
              <th className="text-right font-bold uppercase text-xs pb-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index}>
                <td className="py-2">{item.description}</td>
                <td className="text-right py-2">{item.quantity}</td>
                <td className="text-right py-2">£{(item.price / item.quantity).toFixed(2)}</td>
                <td className="text-right py-2">£{item.price.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-8">
            <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>£{invoice.subTotal.toFixed(2)}</span></div>
                {invoice.discountAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>- £{invoice.discountAmount.toFixed(2)}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">VAT (20%)</span><span>£{invoice.vatAmount.toFixed(2)}</span></div>
                <div className="border-t border-black my-2"></div>
                <div className="flex justify-between font-bold text-lg"><span>Total</span><span>£{invoice.totalAmount.toFixed(2)}</span></div>
            </div>
        </div>
      </main>

      <footer className="mt-8">
        <div className="border-t border-black pt-4">
          {companyProfile?.bankDetails && (
            <div className="bg-gray-50 border border-black/20 rounded-md p-4 mb-4">
              <h3 className="font-bold text-sm text-black uppercase tracking-wide mb-1.5">Payment Details & Bank Account</h3>
              <p className="whitespace-pre-wrap font-bold text-sm text-black leading-relaxed">{companyProfile.bankDetails}</p>
            </div>
          )}
          {invoice.notes && (
            <div className="mb-4">
              <h3 className="font-bold text-xs text-black uppercase tracking-wide mb-1">Notes & Terms</h3>
              <p className="whitespace-pre-wrap text-xs text-black/80">{invoice.notes}</p>
            </div>
          )}
          {companyProfile?.footerText && (
            <div className="border-t border-black/30 pt-3 mt-4 text-center text-xs font-semibold text-black/70 tracking-wide">
              {companyProfile.footerText}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
