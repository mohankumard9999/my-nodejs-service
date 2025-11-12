import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "../../lib/utils"

const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    {...props}
    className={cn(
      // Track: use flex + padding so thumb is always optically centered (no subpixel translate rounding)
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors",
      "disabled:cursor-not-allowed disabled:opacity-50",
      // Move thumb by changing justification instead of translating the thumb
      "data-[state=unchecked]:justify-start data-[state=checked]:justify-end",
      "bg-gray-300 data-[state=checked]:bg-black",
      "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
      className
    )}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        // Thumb (white ball)
        "pointer-events-none h-4 w-4 rounded-full bg-white shadow-md transition-all duration-200 ease-in-out"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }