import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  trend?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function StatCard({ label, value, description, trend, className, children }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-[#161B22] p-6 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.7)] transition-all duration-200 hover:shadow-[0_25px_50px_-20px_rgba(0,0,0,0.8)] hover:-translate-y-0.5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#9AA3B2] mb-2">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-semibold tracking-tight text-[#E6EAF0]">
              {value}
            </p>
            {trend && <div className="flex-shrink-0">{trend}</div>}
          </div>
          {description && (
            <p className="text-sm text-[#9AA3B2] mt-3 leading-relaxed">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
