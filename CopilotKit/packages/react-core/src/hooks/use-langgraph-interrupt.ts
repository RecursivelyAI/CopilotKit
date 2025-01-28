/**
 * <Callout type="info">
 *   Usage of this hook assumes some additional setup in your application, for more information
 *   on that see the CoAgents <span className="text-blue-500">[Agentic Generative UI documentation](/coagents/chat-ui/render-agent-state)</span>.
 * </Callout>
 *
 * The useLangGraphInterrupt hook allows you to render UI components or text as a reaction to an `interrupt` call in your agent.
 *
 * ## Usage
 *
 * ### Simple Usage
 *
 * ```tsx
 * import { useLangGraphInterrupt } from "@copilotkit/react-core";
 *
 * useLangGraphInterrupt({
 *   render: ({ result, event, resolve }) => {
 *     const handleAuth = () => {
 *        ... handle auth
 *        if (authenticated) {
 *          resolve('success')
 *          return;
 *        }
 *        resolve('failure')
 *     }
 *     return (
 *       <div>
 *           Welcome. Click the button below to sign in
 *           <Button onClick={handleAuth}>Sign In</Button>
 *       </div>
 *     );
 *   },
 * });
 * ```
 *
 * This allows for you to render UI components or text based on the `interrupt` thrown in the agent
 */

import { useContext, useEffect } from "react";
import { CopilotContext } from "../context/copilot-context";
import { LangGraphInterruptRender } from "../types/interrupt-action";
import { useCopilotChat } from "./use-copilot-chat";

export function useLangGraphInterrupt(action: LangGraphInterruptRender, dependencies?: any[]) {
  const { setLangGraphInterruptAction, removeLangGraphInterruptAction, langGraphInterruptAction } =
    useContext(CopilotContext);
  const { runChatCompletion } = useCopilotChat();

  useEffect(() => {
    if (langGraphInterruptAction?.event?.response) {
      runChatCompletion();
    }
  }, [langGraphInterruptAction?.event?.response, runChatCompletion]);

  useEffect(() => {
    setLangGraphInterruptAction(action);
    return () => {
      removeLangGraphInterruptAction();
    };
  }, [setLangGraphInterruptAction, removeLangGraphInterruptAction, ...(dependencies || [])]);
}
