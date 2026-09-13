import { Clock, Sparkles, CheckCircle2 } from "lucide-react";
import type { ProductStatus } from "@/lib/data";

const CONFIG: Record<ProductStatus, { label: string; icon: typeof Clock; className: string }> = {
  "coming-soon": {
    label: "Coming Soon",
    icon: Clock,
    className: "bg-charcoal-800 text-white",
  },
  "new-release": {
    label: "New Release",
    icon: Sparkles,
    className: "bg-orange-500 text-white",
  },
  published: {
    label: "Published",
    icon: CheckCircle2,
    className: "bg-green-600 text-white",
  },
};

type Props = {
  status: ProductStatus;
  className?: string;
};

export default function ProductStatusBadge({ status, className = "" }: Props) {
  const cfg = CONFIG[status];
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${cfg.className} ${className}`}
    >
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}
