import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[#C7F000]/30 focus-visible:ring-2 aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-[#C7F000] text-[#0B0F14] rounded-lg hover:bg-[#B8E000]",
        destructive:
          "bg-destructive text-white rounded-lg hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "bg-transparent text-[#E6EAF0] rounded-lg border border-[#1B212B] hover:bg-[#1B212B] hover:border-[#6B7280]/50",
        secondary:
          "bg-[#1B212B] text-[#E6EAF0] rounded-lg hover:bg-[#1B212B]/80 border border-[#1B212B]",
        ghost:
          "rounded-lg hover:bg-[#1B212B] hover:text-[#E6EAF0] text-[#9AA3B2]",
        link: "text-[#C7F000] underline-offset-4 hover:underline rounded-lg",
      },
      size: {
        default: "h-10 px-5 py-2.5 has-[>svg]:px-4",
        sm: "h-8 rounded-lg gap-1.5 px-4 has-[>svg]:px-3 text-xs",
        lg: "h-12 rounded-lg px-8 has-[>svg]:px-6 text-base",
        icon: "size-10 rounded-lg",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-12 rounded-lg",
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
