import { useCallback, useContext, useEffect } from "react";
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
