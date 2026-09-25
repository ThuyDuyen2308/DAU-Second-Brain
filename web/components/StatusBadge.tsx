// components/StatusBadge.tsx
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}

export default function StatusBadge({
  status,
  size = "sm",
  className,
}: StatusBadgeProps) {
  let label = "Chưa xác định hiệu lực";
  let colorClass = "bg-amber-50 text-amber-800 border-amber-200";
  let dotColor = "bg-amber-500";

  if (status === "effective" || status === "active") {
    label = "Còn hiệu lực";
    colorClass = "bg-green-50 text-green-700 border-green-200";
    dotColor = "bg-green-500";
  } else if (status === "expired") {
    label = "Hết hiệu lực";
    colorClass = "bg-red-50 text-red-700 border-red-200";
    dotColor = "bg-red-500";
  }

  const sizeClass = size === "sm"
    ? "px-2.5 py-0.5 text-xs"
    : "px-3 py-1 text-sm";

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border gap-1.5",
        colorClass,
        sizeClass,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotColor)} />
      {label}
    </span>
  );
}
