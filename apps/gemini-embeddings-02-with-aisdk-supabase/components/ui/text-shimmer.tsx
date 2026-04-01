"use client";

import { cn } from "@/lib/utils";

export type TextShimmerProps = {
  as?: string;
  duration?: number;
  spread?: number;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>;

export function TextShimmer({
  as = "span",
  className,
  children,
  ...props
}: TextShimmerProps) {
  const Component = as as React.ElementType;

  return (
    <Component
      className={cn("font-medium text-stone-500 animate-pulse", className)}
      {...props}
    >
      {children}
    </Component>
  );
}
