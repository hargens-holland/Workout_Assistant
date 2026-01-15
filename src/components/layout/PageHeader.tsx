import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-12", className)}>
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-[#E6EAF0] mb-3">
            {title}
          </h1>
          {description && (
            <p className="text-[#9AA3B2] text-lg leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
