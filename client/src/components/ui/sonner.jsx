import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-black group-[.toaster]:!border-0 group-[.toaster]:shadow-xl group-[.toaster]:rounded-lg group-[.toaster]:text-xs group-[.toaster]:font-bold group-[.toaster]:max-w-md",
          description: "group-[.toast]:text-gray-600 group-[.toast]:text-xs group-[.toast]:font-medium",
          actionButton:
            "group-[.toast]:!bg-black group-[.toast]:!text-white group-[.toast]:hover:!bg-gray-800 group-[.toast]:rounded-md group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:font-medium group-[.toast]:text-xs",
          cancelButton:
            "group-[.toast]:bg-gray-100 group-[.toast]:text-gray-700 group-[.toast]:hover:bg-gray-200 group-[.toast]:text-xs",
          error: "group-[.toaster]:!bg-white group-[.toaster]:!text-black group-[.toaster]:!border-0",
          success: "group-[.toaster]:!bg-white group-[.toaster]:!text-black group-[.toaster]:!border-0",
          info: "group-[.toaster]:!bg-white group-[.toaster]:!text-black group-[.toaster]:!border-0",
        },
      }}
      {...props} />
  );
}

export { Toaster }




