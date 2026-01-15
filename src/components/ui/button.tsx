import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[#C7F000]/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-[#C7F000] text-[#0B0F14] rounded-full shadow-[0_0_20px_rgba(199,240,0,0.35),0_20px_40px_-20px_rgba(0,0,0,0.7)] hover:shadow-[0_0_30px_rgba(199,240,0,0.35),0_25px_50px_-20px_rgba(0,0,0,0.8)] hover:-translate-y-0.5 hover:bg-[#C7F000]/90",
        destructive:
          "bg-destructive text-white rounded-full shadow-[0_20px_40px_-20px_rgba(0,0,0,0.7)] hover:shadow-[0_25px_50px_-20px_rgba(0,0,0,0.8)] hover:-translate-y-0.5 hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "bg-[#161B22] text-[#E6EAF0] rounded-xl shadow-[0_20px_40px_-20px_rgba(0,0,0,0.7)] hover:shadow-[0_25px_50px_-20px_rgba(0,0,0,0.8)] hover:-translate-y-0.5 hover:bg-[#1B212B]",
        secondary:
          "bg-[#1B212B] text-[#E6EAF0] rounded-xl shadow-[0_20px_40px_-20px_rgba(0,0,0,0.7)] hover:shadow-[0_25px_50px_-20px_rgba(0,0,0,0.8)] hover:-translate-y-0.5 hover:bg-[#1B212B]/80",
        ghost:
          "rounded-xl hover:bg-[#1B212B]/50 hover:text-[#E6EAF0]",
        link: "text-[#C7F000] underline-offset-4 hover:underline rounded-xl",
      },
      size: {
        default: "h-10 px-5 py-2.5 has-[>svg]:px-4",
        sm: "h-8 rounded-full gap-1.5 px-4 has-[>svg]:px-3 text-xs",
        lg: "h-12 rounded-full px-8 has-[>svg]:px-6 text-base",
        icon: "size-10 rounded-full",
        "icon-sm": "size-8 rounded-full",
        "icon-lg": "size-12 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
