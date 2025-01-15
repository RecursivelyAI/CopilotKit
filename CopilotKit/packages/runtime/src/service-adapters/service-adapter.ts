import { Message } from "../graphql/types/converted";
import { RuntimeEventSource } from "./events";
import { ActionInput } from "../graphql/inputs/action.input";
import { ForwardedParametersInput } from "../graphql/inputs/forwarded-parameters.input";
import { ExtensionsInput } from "../graphql/inputs/extensions.input";
import { ExtensionsResponse } from "../graphql/types/extensions-response.type";

export interface CopilotKitResponse {
  stream: ReadableStream;
  headers?: Record<string, string>;
}

export interface CopilotRuntimeChatCompletionRequest {
  eventSource: RuntimeEventSource;
  messages: Message[];
  actions: ActionInput[];
  model?: string;
  threadId?: string;
  runId?: string;
  forwardedParameters?: ForwardedParametersInput;
  extensions?: ExtensionsInput;
}

export interface CopilotRuntimeChatCompletionResponse {
  threadId: string;
  runId?: string;
  extensions?: ExtensionsResponse;
}

export interface CopilotServiceAdapter {
  process(
    request: CopilotRuntimeChatCompletionRequest,
  ): Promise<CopilotRuntimeChatCompletionResponse>;
}
