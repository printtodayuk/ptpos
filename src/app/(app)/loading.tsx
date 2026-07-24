'use client';

import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center p-8 animate-in fade-in-50 duration-300">
      <div className="relative flex flex-col items-center justify-center">
        {/* Outer glowing background ring */}
        <div className="absolute w-24 h-24 rounded-full bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-xl animate-pulse" />
        
        {/* Modern Dual Ring Loader */}
        <div className="relative flex items-center justify-center mb-5">
          <div className="h-14 w-14 rounded-full border-4 border-slate-200 dark:border-slate-800 border-t-indigo-600 dark:border-t-indigo-400 animate-spin" />
          <Sparkles className="absolute h-6 w-6 text-indigo-600 dark:text-indigo-400 animate-pulse" />
        </div>

        {/* Text Callout */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold tracking-tight text-slate-800 dark:text-slate-200">
            Loading Workspace...
          </span>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">
          Preparing live POS data & graphics studio
        </p>
      </div>
    </div>
  );
}
