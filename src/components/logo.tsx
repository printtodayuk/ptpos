import type { SVGProps } from 'react';
import { Printer } from 'lucide-react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <div className="inline-flex items-center gap-2.5">
      <div className="p-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md">
        <Printer className="h-5 w-5" />
      </div>
      <span className="text-xl font-extrabold tracking-tight font-headline">
        <span className="text-[#012169] dark:text-indigo-400">Print Today</span>
        <span className="text-[#C8102E] ml-1.5 font-black">EPOS</span>
      </span>
    </div>
  );
}
