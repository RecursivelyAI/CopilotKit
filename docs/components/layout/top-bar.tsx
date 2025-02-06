"use client";
import { SearchIcon } from "lucide-react";
import { Socials } from "@/components/react/socials";

export function TopBar() {
  return (
    <>
      <div className="p-2 h-[70px] hidden lg:block absolute w-[calc(100vw-var(--fd-sidebar-width)-20px)] ml-[var(--fd-sidebar-width)]">
          <div className="flex justify-end items-center gap-2">
            <SearchToggle />
        </div>
      </div>
    </>
  );
}

export function SearchToggle() {
  const toggleSearch = () => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        metaKey: isMac,
        ctrlKey: !isMac,
        bubbles: true,
      })
    );
  };
  
  return (
    <div onClick={toggleSearch} className="cursor-pointer h-12 px-4 w-[240px] xl:w-[275px] inline-flex items-center gap-2 border bg-fd-secondary/50 p-1.5 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground rounded-md max-md:hidden">
      <SearchIcon className="w-4 h-4 text-foreground" />
      Search docs
      <div className="ms-auto inline-flex gap-0.5">
        <kbd className="rounded-md border bg-fd-background px-1.5">⌘</kbd>
        <kbd className="rounded-md border bg-fd-background px-1.5">K</kbd>
      </div>
    </div>
  );
}
