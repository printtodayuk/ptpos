import { QuotationReportClient } from "@/components/quotations/quotation-report-client";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function QuotationReportPage() {
  return (
    <div className="flex flex-col gap-6">
       <CardHeader className="p-0">
            <CardTitle>Quotation Reporting</CardTitle>
            <CardDescription>Search and export all quotation data.</CardDescription>
        </CardHeader>
      <QuotationReportClient />
    </div>
  );
}
