import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageProps {
  children: ReactNode;
  className?: string;
}

export function Page({ children, className }: PageProps): React.JSX.Element {
  return (
    <div className={cn("min-h-screen w-full bg-[#0B0F14]", className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {children}
      </div>
    </div>
  );
}
