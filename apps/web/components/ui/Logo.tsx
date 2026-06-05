/**
 * CyberSaathi logo — stylized lotus-and-shield mark, drawn as inline SVG so
 * the entire app uses one consistent visual mark without external assets.
 */

import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="CyberSaathi"
      className={cn("shrink-0", className)}
    >
      <title>CyberSaathi</title>
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="8"
        fill="hsl(var(--primary))"
      />
      <path
        d="M16 7l7 3v6.5c0 4.5-3.4 7.6-7 8.5-3.6-.9-7-4-7-8.5V10l7-3z"
        fill="hsl(var(--card))"
        opacity="0.95"
      />
      <path
        d="M12 16l3 3 5-5"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
