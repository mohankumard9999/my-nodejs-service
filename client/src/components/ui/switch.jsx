import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "../../lib/utils"

const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    {...props}
    className={cn(
      // Track styles
      "peer relative inline-flex h-3 w-5 shrink-0 cursor-pointer items-center rounded-full transition-colors",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300",
      "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
      className
    )}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        // Thumb (white ball)
        "pointer-events-none absolute left-[1.5px] top-[1.5px] h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out",
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }