import { QuotationReportClient } from "@/components/quotations/quotation-report-client";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeatureGuard } from '@/components/features/feature-guard';

export default function QuotationReportPage() {
  return (
    <FeatureGuard featureKey="reports">
      <div className="flex flex-col gap-6">
        <CardHeader className="p-0">
              <CardTitle>Quotation Reporting</CardTitle>
              <CardDescription>Search and export all quotation data.</CardDescription>
          </CardHeader>
        <QuotationReportClient />
      </div>
    </FeatureGuard>
  );
}
