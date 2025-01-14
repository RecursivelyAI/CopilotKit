import "./globals.css";
import type { Metadata } from "next";
import { CopilotKit } from "@copilotkit/react-core";
import { StateMachineProvider } from "@/lib/use-copilot-state-machine";

export const metadata: Metadata = {
  title: "State Machine Example",
  description: "State Machine Example",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <CopilotKit
          publicApiKey={process.env.NEXT_PUBLIC_CPK_PUBLIC_API_KEY}
          showDevConsole={false}
        >
          <StateMachineProvider>
            {children}
          </StateMachineProvider>
        </CopilotKit>
      </body>
    </html>
  );
} 
