// components/StatusBadge.tsx
import React from "react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string | null | undefined;
  isVerified?: boolean;
  size?: "sm" | "md";
  className?: string;
  showTooltip?: boolean;
}

export default function StatusBadge({
  status,
  isVerified = false,
  size = "sm",
  className,
}: StatusBadgeProps) {
  let label = "Chưa xác minh";
  let colorClass = "bg-amber-50 text-amber-800 border-amber-200/80";
  let dotColor = "bg-amber-500";

  const st = (status || "").toLowerCase().trim();

  if (st === "effective" || st === "active") {
    label = "Còn hiệu lực";
    colorClass = "bg-emerald-50 text-emerald-800 border-emerald-200/80";
    dotColor = "bg-emerald-500";
  } else if (st === "deadline_passed") {
    label = "Hết thời hạn thực hiện";
    colorClass = "bg-indigo-50 text-indigo-800 border-indigo-200/80";
    dotColor = "bg-indigo-500";
  } else if (st === "expired") {
    label = "Hết hiệu lực";
    colorClass = "bg-rose-50 text-rose-800 border-rose-200/80";
    dotColor = "bg-rose-500";
  } else if (st === "replaced") {
    label = "Đã bị thay thế";
    colorClass = "bg-slate-100 text-slate-700 border-slate-300/80";
    dotColor = "bg-slate-500";
  } else if (st === "unverified" || st === "unknown") {
    label = "Chưa xác minh";
    colorClass = "bg-amber-50 text-amber-800 border-amber-200/80";
    dotColor = "bg-amber-500";
  }

  const sizeClass = size === "sm"
    ? "px-2.5 py-0.5 text-xs font-semibold"
    : "px-3 py-1 text-xs sm:text-sm font-semibold";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border gap-1.5 shadow-xs transition-colors",
        colorClass,
        sizeClass,
        className
      )}
      title={isVerified ? "Đã được Admin xác minh và duyệt căn cứ" : "Trạng thái tự động đề xuất từ nội dung bóc tách"}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
      <span>{label}</span>
      {isVerified && (
        <svg
          className="w-3.5 h-3.5 text-blue-600 shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <title>Đã xác minh</title>
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </span>
  );
}

