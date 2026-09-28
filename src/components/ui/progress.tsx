import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative h-2 w-full overflow-hidden rounded-sm bg-secondary", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      {...props}
    >
      <div
        className="h-full bg-primary transition-transform"
        style={{ transform: `translateX(-${100 - Math.max(0, Math.min(value, 100))}%)` }}
      />
    </div>
  ),
);
Progress.displayName = "Progress";

export { Progress };
