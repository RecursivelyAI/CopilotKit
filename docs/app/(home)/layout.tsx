import { DocsLayout } from "fumadocs-ui/layout";
import type { ReactNode } from "react";
import { baseOptions } from "../layout.config";
import { source } from "@/app/source";
import { SubdocsMenu } from "@/components/react/subdocs-menu";
import { TerminalIcon, RocketIcon } from "lucide-react";
import { PiGraph, PiGraduationCap} from "react-icons/pi";
import { TopBar } from "@/components/layout/top-bar";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <TopBar />
      <DocsLayout
        tree={source.pageTree}
        {...baseOptions}
        sidebar={{
          hideSearch: true,
          banner: (
            <SubdocsMenu
              options={[
                {
                  title: "Standard",
                  description: "Documentation for building Copilots",
                  url: "/",
                  icon: <RocketIcon className="w-4 h-4" />,
                  bgGradient:
                    "bg-gradient-to-b from-indigo-700 to-indigo-400 text-indigo-100",
                  selectedStyle: "ring-indigo-500/70 ring-2 rounded-sm",
                },
                {
                  title: "CoAgents (Public Beta)",
                  description: "Documentation for CoAgents with LangGraph",
                  url: "/coagents",
                  icon: <PiGraph className="w-4 h-4 text-bold" />,
                  bgGradient:
                    "bg-gradient-to-b from-purple-700 to-purple-400 text-purple-100",
                  selectedStyle: "ring-purple-500/70 ring-2 rounded-sm",
                },
                {
                  title: "API Reference",
                  description: "API Reference",
                  url: "/reference",
                  icon: <TerminalIcon className="w-4 h-4" />,
                  bgGradient:
                    "bg-gradient-to-b from-teal-700 to-teal-400 text-teal-100",
                  selectedStyle: "ring-teal-500/70 ring-2 rounded-sm",
                },
                // {
                //   title: "Chat with our docs",
                //   description: "Chat with our docs",
                //   url: "https://entelligence.ai/CopilotKit&CopilotKit",
                //   icon: <CircleArrowOutUpRight className="w-4 h-4" />,
                //   bgGradient:
                //     "bg-gradient-to-b from-purple-700 to-purple-400 text-purple-100",
                //   selectedBorder: "ring-teal-500/70",
                // },
              ]}
            />
          ),
        }}
      >
        {children}
      </DocsLayout>
    </>
  );
}
