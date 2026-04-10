
'use client';

import { useEffect, useState } from 'react';
import { getCurrentNotice } from '@/lib/server-actions-notices';
import type { Notice } from '@/lib/types';
import { Megaphone, X } from 'lucide-react';
import { format } from 'date-fns';

export function NoticeDisplay() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    getCurrentNotice().then(setNotice);
  }, []);

  if (!notice || !notice.content || !isVisible) return null;

  return (
    <div className="relative mb-6 bg-gradient-to-r from-primary to-accent rounded-xl p-4 text-white shadow-lg overflow-hidden group">
      {/* Decorative background element */}
      <div className="absolute top-[-20%] right-[-5%] w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
      
      <div className="flex items-start gap-4 relative z-10">
        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md">
          <Megaphone className="h-6 w-6 animate-pulse" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg tracking-tight uppercase">Important Notice</h3>
            <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded-full uppercase tracking-widest font-semibold">
              Updated: {format(new Date(notice.updatedAt as string), 'dd MMM, p')}
            </span>
          </div>
          <p className="mt-1 text-sm md:text-base font-medium leading-relaxed whitespace-pre-wrap drop-shadow-sm">
            {notice.content}
          </p>
          {notice.updatedBy && (
            <p className="mt-2 text-[10px] italic opacity-80 text-right">— Posted by {notice.updatedBy}</p>
          )}
        </div>
        <button 
          onClick={() => setIsVisible(false)}
          className="hover:bg-white/20 p-1 rounded-full transition-colors"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
