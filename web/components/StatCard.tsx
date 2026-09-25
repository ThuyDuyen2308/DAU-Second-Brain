// components/StatCard.tsx
import { cn } from "@/lib/utils";

interface StatCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  className?: string;
}

export default function StatCard({ value, label, sublabel, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-slate-200 px-6 py-5 shadow-sm",
        className
      )}
    >
      <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
        {value}
      </div>
      <div className="text-sm font-semibold text-slate-700 mt-1">{label}</div>
      {sublabel && (
        <div className="text-xs text-slate-400 mt-0.5">{sublabel}</div>
      )}
    </div>
  );
}
