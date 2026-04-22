import { ReportClient } from "@/components/reporting/report-client";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeatureGuard } from '@/components/features/feature-guard';

export default function ReportingPage() {
  return (
    <FeatureGuard featureKey="transactions">
      <div className="flex flex-col gap-6">
        <CardHeader className="p-0">
              <CardTitle>Transactions</CardTitle>
              <CardDescription>Generate reports and export sales data.</CardDescription>
          </CardHeader>
        <ReportClient />
      </div>
    </FeatureGuard>
  );
}
