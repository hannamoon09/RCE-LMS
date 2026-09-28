import logoUrl from "@/assets/rce-logo-small.webp";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  compact?: boolean;
  className?: string;
};

export function BrandMark({ compact = false, className }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-background shadow-rce-line",
          compact ? "h-10 w-10" : "h-12 w-12",
        )}
      >
        <img src={logoUrl} alt="RCE logo" className="h-full w-full object-cover" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold tracking-normal text-foreground">RCE LMS</p>
          <p className="text-xs text-muted-foreground">Security Learning Hub</p>
        </div>
      )}
    </div>
  );
}
