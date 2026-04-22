'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppFeatures } from '@/lib/types';
import { getAppFeatures } from '@/lib/server-actions-features';

interface FeatureContextType {
  features: AppFeatures;
  isLoading: boolean;
  refreshFeatures: () => Promise<void>;
}

const defaultFeatures: AppFeatures = {
  createJobSheet: true,
  transactions: true,
  createQuotation: true,
  createInvoice: true,
  manageContacts: true,
  manageTasks: true,
  attendance: true,
  reports: true,
};

const FeatureContext = createContext<FeatureContextType>({
  features: defaultFeatures,
  isLoading: true,
  refreshFeatures: async () => {},
});

export const useFeatures = () => useContext(FeatureContext);

export function FeatureProvider({ children }: { children: React.ReactNode }) {
  const [features, setFeatures] = useState<AppFeatures>(defaultFeatures);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFeatures = async () => {
    try {
      setIsLoading(true);
      const data = await getAppFeatures();
      setFeatures(data);
    } catch (error) {
      console.error('Failed to fetch features:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatures();
  }, []);

  return (
    <FeatureContext.Provider value={{ features, isLoading, refreshFeatures: fetchFeatures }}>
      {children}
    </FeatureContext.Provider>
  );
}
