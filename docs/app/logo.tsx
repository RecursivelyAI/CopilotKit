import Image from "next/image";

export function Logo() {

  return (
    // <div className="w-[--fd-sidebar-width] flex items-center justify-center gap-1 ml-[-12px]">
    <div className="flex items-center justify-center gap-1 md:px-6 py-2">
      <Image src={"/copilotkit-logo-light.png"} width={150} height={40} alt="Logo" className="block dark:hidden" />
      <Image src={"/copilotkit-logo-dark.png"} width={150} height={40} alt="Logo" className="hidden dark:block" />
    </div>
  )
  
}