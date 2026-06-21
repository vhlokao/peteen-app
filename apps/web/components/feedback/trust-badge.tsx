import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TrustSignalLevel } from "@/types";

const trustLabels: Record<TrustSignalLevel, string> = {
  low: "Confiança inicial",
  medium: "Confiança em construção",
  high: "Alta confiança",
  verified: "Verificado",
};

type TrustBadgeProps = {
  level?: TrustSignalLevel;
  label?: string;
  className?: string;
};

export function TrustBadge({
  level = "medium",
  label,
  className,
}: TrustBadgeProps) {
  return (
    <Badge variant="trust" className={cn("gap-1", className)}>
      <ShieldCheck className="size-3" />
      {label ?? trustLabels[level]}
    </Badge>
  );
}
