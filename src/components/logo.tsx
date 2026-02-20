import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 40"
      width="200"
      height="40"
      aria-label="AI Studio EPOS Logo"
      {...props}
    >
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontFamily="var(--font-headline), sans-serif"
        fontSize="24"
        fontWeight="bold"
      >
        <tspan fill="#012169">AI Studio</tspan>
        <tspan fill="#C8102E"> EPOS</tspan>
      </text>
    </svg>
  );
}
