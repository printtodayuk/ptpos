import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 40"
      width="200"
      height="40"
      aria-label="Print Today Logo"
      {...props}
    >
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontFamily="var(--font-headline), sans-serif"
        fontSize="28"
        fontWeight="bold"
      >
        <tspan fill="#012169">Print</tspan>
        <tspan fill="#C8102E"> Today</tspan>
      </text>
    </svg>
  );
}
