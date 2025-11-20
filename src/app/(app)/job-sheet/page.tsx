'use client';
import { useState } from 'react';
import { JobSheetForm } from "@/components/jobs/job-sheet-form";
import { SearchJobSheets } from '@/components/jobs/search-job-sheets';

export default function JobSheetPage() {
  const [key, setKey] = useState(Date.now());

  const handleJobSheetUpdate = () => {
    setKey(Date.now());
  };

  return (
    <div className="flex flex-col gap-6">
      <JobSheetForm onJobSheetAdded={handleJobSheetUpdate} />
      <SearchJobSheets key={key} onJobSheetUpdated={handleJobSheetUpdate} />
    </div>
  );
}
