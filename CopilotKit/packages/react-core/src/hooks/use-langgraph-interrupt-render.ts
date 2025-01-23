import { useCopilotContext } from "../context";
import React, { useCallback } from "react";

export function useLangGraphInterruptRender(): string | React.ReactElement | null {
  const { langGraphInterruptAction, setLangGraphInterruptAction } = useCopilotContext();

  const responseRef = React.useRef<string>();
  const resolveInterrupt = useCallback(
    (response: string) => {
      responseRef.current = response;
      // Use setTimeout to defer the state update to next tick
      setTimeout(() => {
        setLangGraphInterruptAction({ event: { response } });
      }, 0);
    },
    [setLangGraphInterruptAction],
  );

  if (
    !langGraphInterruptAction ||
    !langGraphInterruptAction.event ||
    (!langGraphInterruptAction.render && !langGraphInterruptAction.handler)
  )
    return null;

  const { render, handler, event } = langGraphInterruptAction;

  let result = null;
  if (handler) {
    result = handler({
      event,
      resolve: resolveInterrupt,
    });
  }

  if (render) {
    return render({
      event,
      result,
      resolve: resolveInterrupt,
    });
  }

  return null;
}
