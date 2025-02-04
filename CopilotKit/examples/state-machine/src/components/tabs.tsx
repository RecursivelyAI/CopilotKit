"use client";

import { ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  wrapperClassName?: string;
  navClassName?: string;
  buttonClassName?: string;
  activeButtonClassName?: string;
  inactiveButtonClassName?: string;
  contentClassName?: string;
}

export function Tabs({
  tabs,
  activeTab,
  onTabChange,
  wrapperClassName = "border rounded-2xl h-full bg-white overflow-hidden flex flex-col",
  navClassName = "bg-blue-500 p-3 md:p-4 rounded-t-2xl",
  buttonClassName = "px-4 py-2 rounded-lg text-sm",
  activeButtonClassName = "bg-white text-blue-500",
  inactiveButtonClassName = "bg-blue-400 text-white",
  contentClassName = "p-2 md:p-4 overflow-y-auto flex-1",
}: TabsProps) {
  return (
    <div className={wrapperClassName}>
      <nav className={navClassName}>
        <div className="grid grid-cols-2 gap-2">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`${buttonClassName} ${
                activeTab === id ? activeButtonClassName : inactiveButtonClassName
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
      <main className={contentClassName}>{tabs.find((tab) => tab.id === activeTab)?.content}</main>
    </div>
  );
}
