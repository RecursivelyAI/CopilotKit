import { LangGraphInterruptEvent } from "@copilotkit/runtime-client-gql";

export interface LangGraphInterruptRender {
  /**
   * The handler function to handle the event.
   */
  handler?: (props: {
    event: LangGraphInterruptEvent;
    resolve: (resolution: string) => void;
  }) => unknown | Promise<unknown>;
  /**
   * The render function to handle the event.
   */
  render?: (props: {
    result: unknown;
    event: LangGraphInterruptEvent;
    resolve: (resolution: string) => void;
  }) => string | React.ReactElement;
}

export type LangGraphInterruptAction = LangGraphInterruptRender & {
  event?: LangGraphInterruptEvent;
};

export type LangGraphInterruptActionSetterArgs =
  | (Partial<LangGraphInterruptRender> & { event?: Partial<LangGraphInterruptEvent> })
  | null;
export type LangGraphInterruptActionSetter = (action: LangGraphInterruptActionSetterArgs) => void;
