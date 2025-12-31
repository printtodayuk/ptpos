'use client';
import { useState } from 'react';
import { QuotationForm } from "@/components/quotations/quotation-form";
import { SearchQuotations } from '@/components/quotations/search-quotations';

export default function QuotationPage() {
  const [key, setKey] = useState(Date.now());

  const handleQuotationUpdate = () => {
    setKey(Date.now());
  };

  return (
    <div className="flex flex-col gap-6">
      <QuotationForm onQuotationAdded={handleQuotationUpdate} />
      <SearchQuotations key={key} onQuotationUpdated={handleQuotationUpdate} />
    </div>
  );
}
