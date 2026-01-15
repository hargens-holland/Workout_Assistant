import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SectionProps {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  headerAction?: ReactNode;
}

export function Section({ children, title, description, className, headerAction }: SectionProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {(title || description || headerAction) && (
        <div className="flex items-start justify-between gap-6">
          <div>
            {title && (
              <h2 className="text-2xl font-semibold tracking-tight text-[#E6EAF0] mb-2">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-base text-[#9AA3B2] leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
