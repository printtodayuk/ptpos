import { JsReportClient } from "@/components/jobs/js-report-client";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeatureGuard } from '@/components/features/feature-guard';

export default function JsReportPage() {
  return (
    <FeatureGuard featureKey="reports">
      <div className="flex flex-col gap-6">
        <CardHeader className="p-0">
              <CardTitle>Job Sheet Reporting</CardTitle>
              <CardDescription>Search and export all job sheet data.</CardDescription>
          </CardHeader>
        <JsReportClient />
      </div>
    </FeatureGuard>
  );
}
