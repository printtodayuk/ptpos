'use client';

import React from 'react';
import { useFeatures } from '@/components/features/feature-provider';
import { AppFeatures } from '@/lib/types';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface FeatureGuardProps {
  featureKey: keyof AppFeatures;
  children: React.ReactNode;
}

export function FeatureGuard({ featureKey, children }: FeatureGuardProps) {
  const { features, isLoading } = useFeatures();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!features[featureKey]) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[50vh] p-8 text-center space-y-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h2 className="text-2xl font-bold">Feature Disabled</h2>
        <p className="text-muted-foreground max-w-md">
          This feature is currently disabled by the Administrator. If you believe this is an error, please contact your supervisor.
        </p>
        <Button asChild className="mt-4">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Return to Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
