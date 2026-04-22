
'use client';
import { useState } from 'react';
import { QuotationForm } from "@/components/quotations/quotation-form";
import { SearchQuotations } from '@/components/quotations/search-quotations';
import { FeatureGuard } from '@/components/features/feature-guard';

export default function QuotationPage() {
  const [key, setKey] = useState(Date.now());

  const handleQuotationUpdate = () => {
    setKey(Date.now());
  };

  return (
    <FeatureGuard featureKey="createQuotation">
      <div className="flex flex-col gap-6">
        <QuotationForm key={`form-${key}`} onQuotationAdded={handleQuotationUpdate} />
        <SearchQuotations key={`search-${key}`} onQuotationUpdated={handleQuotationUpdate} />
      </div>
    </FeatureGuard>
  );
}
