'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  return (
    <>
      {/* Top progress bar for page navigation */}
      <div
        className={`fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 z-50 transition-all duration-300 pointer-events-none ${
          isNavigating ? 'opacity-100 scale-x-100 animate-pulse' : 'opacity-0 scale-x-0'
        }`}
        style={{ transformOrigin: '0% 50%' }}
      />
      
      {/* Page container with smooth fade & slide up animation */}
      <div 
        key={`${pathname}?${searchParams.toString()}`}
        className="w-full h-full flex-1 flex flex-col animate-in fade-in-50 slide-in-from-bottom-2 duration-300"
      >
        {children}
      </div>
    </>
  );
}
