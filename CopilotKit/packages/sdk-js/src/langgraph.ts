import { RunnableConfig } from "@langchain/core/runnables";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { convertJsonSchemaToZodSchema, randomId } from "@copilotkit/shared";
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { DynamicStructuredTool } from "@langchain/core/tools";

interface IntermediateStateConfig {
  stateKey: string;
  tool: string;
  toolArgument?: string;
}

interface OptionsConfig {
  emitToolCalls?: boolean | string | string[];
  emitMessages?: boolean;
  emitAll?: boolean;
  emitIntermediateState?: IntermediateStateConfig[];
}

export const CopilotKitPropertiesAnnotation = Annotation.Root({
  actions: Annotation<any[]>,
});

export const CopilotKitStateAnnotation = Annotation.Root({
  copilotkit: Annotation<typeof CopilotKitPropertiesAnnotation.State>,
  ...MessagesAnnotation.spec,
});

export type CopilotKitState = typeof CopilotKitStateAnnotation.State;
export type CopilotKitProperties = typeof CopilotKitPropertiesAnnotation.State;

/**
 * Customize the LangGraph configuration for use in CopilotKit.
 *
 * To the CopilotKit SDK, run:
 *
 * ```bash
 * npm install @copilotkit/sdk-js
 * ```
 *
 * ### Examples
 *
 * Disable emitting messages and tool calls:
 *
 * ```typescript
 * import { copilotkitCustomizeConfig } from "@copilotkit/sdk-js";
 *
 * config = copilotkitCustomizeConfig(
 *   config,
 *   emitMessages=false,
 *   emitToolCalls=false
 * )
 * ```
 *
 * To emit a tool call as streaming LangGraph state, pass the destination key in state,
 * the tool name and optionally the tool argument. (If you don't pass the argument name,
 * all arguments are emitted under the state key.)
 *
 * ```typescript
 * import { copilotkitCustomizeConfig } from "@copilotkit/sdk-js";
 *
 * config = copilotkitCustomizeConfig(
 *   config,
 *   emitIntermediateState=[
 *     {
 *       "stateKey": "steps",
 *       "tool": "SearchTool",
 *       "toolArgument": "steps",
 *     },
 *   ],
 * )
 * ```
 */
export function copilotkitCustomizeConfig(
  /**
   * The LangChain/LangGraph configuration to customize.
   */
  baseConfig: RunnableConfig,
  /**
   * Configuration options:
   * - `emitMessages: boolean?`
   *   Configure how messages are emitted. By default, all messages are emitted. Pass false to
   *   disable emitting messages.
   * - `emitToolCalls: boolean | string | string[]?`
   *   Configure how tool calls are emitted. By default, all tool calls are emitted. Pass false to
   *   disable emitting tool calls. Pass a string or list of strings to emit only specific tool calls.
   * - `emitIntermediateState: IntermediateStateConfig[]?`
   *   Lets you emit tool calls as streaming LangGraph state.
   */
  options?: OptionsConfig,
): RunnableConfig {
  const metadata = baseConfig?.metadata || {};

  if (options?.emitAll) {
    metadata["copilotkit:emit-tool-calls"] = true;
    metadata["copilotkit:emit-messages"] = true;
  } else {
    if (options?.emitToolCalls !== undefined) {
      metadata["copilotkit:emit-tool-calls"] = options.emitToolCalls;
    }
    if (options?.emitMessages !== undefined) {
      metadata["copilotkit:emit-messages"] = options.emitMessages;
    }
  }

  if (options?.emitIntermediateState) {
    const snakeCaseIntermediateState = options.emitIntermediateState.map((state) => ({
      tool: state.tool,
      tool_argument: state.toolArgument,
      state_key: state.stateKey,
    }));

    metadata["copilotkit:emit-intermediate-state"] = snakeCaseIntermediateState;
  }

  baseConfig = baseConfig || {};

  return {
    ...baseConfig,
    metadata: metadata,
  };
}
/**
 * Exits the current agent after the run completes. Calling copilotkit_exit() will
 * not immediately stop the agent. Instead, it signals to CopilotKit to stop the agent after
 * the run completes.
 *
 * ### Examples
 *
 * ```typescript
 * import { copilotkitExit } from "@copilotkit/sdk-js";
 *
 * async function myNode(state: Any):
 *   await copilotkitExit(config)
 *   return state
 * ```
 */
export async function copilotkitExit(
  /**
   * The LangChain/LangGraph configuration.
   */
  config: RunnableConfig,
) {
  await dispatchCustomEvent("copilotkit_exit", {}, config);
}
/**
 * Emits intermediate state to CopilotKit. Useful if you have a longer running node and you want to
 * update the user with the current state of the node.
 *
 * ### Examples
 *
 * ```typescript
 * import { copilotkitEmitState } from "@copilotkit/sdk-js";
 *
 * for (let i = 0; i < 10; i++) {
 *   await someLongRunningOperation(i);
 *   await copilotkitEmitState(config, { progress: i });
 * }
 * ```
 */
export async function copilotkitEmitState(
  /**
   * The LangChain/LangGraph configuration.
   */
  config: RunnableConfig,
  /**
   * The state to emit.
   */
  state: any,
) {
  await dispatchCustomEvent("copilotkit_manually_emit_intermediate_state", state, config);
}
/**
 * Manually emits a message to CopilotKit. Useful in longer running nodes to update the user.
 * Important: You still need to return the messages from the node.
 *
 * ### Examples
 *
 * ```typescript
 * import { copilotkitEmitMessage } from "@copilotkit/sdk-js";
 *
 * const message = "Step 1 of 10 complete";
 * await copilotkitEmitMessage(config, message);
 *
 * // Return the message from the node
 * return {
 *   "messages": [AIMessage(content=message)]
 * }
 * ```
 */
export async function copilotkitEmitMessage(
  /**
   * The LangChain/LangGraph configuration.
   */
  config: RunnableConfig,
  /**
   * The message to emit.
   */
  message: string,
) {
  await dispatchCustomEvent(
    "copilotkit_manually_emit_message",
    { message, message_id: randomId(), role: "assistant" },
    config,
  );
}
/**
 * Manually emits a tool call to CopilotKit.
 *
 * ### Examples
 *
 * ```typescript
 * import { copilotkitEmitToolCall } from "@copilotkit/sdk-js";
 *
 * await copilotkitEmitToolCall(config, name="SearchTool", args={"steps": 10})
 * ```
 */
export async function copilotkitEmitToolCall(
  /**
   * The LangChain/LangGraph configuration.
   */
  config: RunnableConfig,
  /**
   * The name of the tool to emit.
   */
  name: string,
  /**
   * The arguments to emit.
   */
  args: any,
) {
  await dispatchCustomEvent(
    "copilotkit_manually_emit_tool_call",
    { name, args, id: randomId() },
    config,
  );
}

export function convertActionToDynamicStructuredTool(actionInput: any) {
  return new DynamicStructuredTool({
    name: actionInput.name,
    description: actionInput.description,
    schema: convertJsonSchemaToZodSchema(actionInput.parameters, true),
    func: async () => {
      return "";
    },
  });
}
/**
 * Use this function to convert a list of actions you get from state
 * to a list of dynamic structured tools.
 *
 * ### Examples
 *
 * ```typescript
 * import { convertActionsToDynamicStructuredTools } from "@copilotkit/sdk-js";
 *
 * const tools = convertActionsToDynamicStructuredTools(state.copilotkit.actions);
 * ```
 */
export function convertActionsToDynamicStructuredTools(
  /**
   * The list of actions to convert.
   */
  actions: any[],
) {
  return actions.map((action) => convertActionToDynamicStructuredTool(action));
}
