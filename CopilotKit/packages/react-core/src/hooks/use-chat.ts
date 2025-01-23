import React, { useCallback, useRef } from "react";
import {
  FunctionCallHandler,
  COPILOT_CLOUD_PUBLIC_API_KEY_HEADER,
  CoAgentStateRenderHandler,
  randomId,
} from "@copilotkit/shared";
import {
  Message,
  TextMessage,
  ResultMessage,
  convertMessagesToGqlInput,
  filterAdjacentAgentStateMessages,
  filterAgentStateMessages,
  convertGqlOutputToMessages,
  MessageStatusCode,
  MessageRole,
  Role,
  CopilotRequestType,
  ForwardedParametersInput,
  loadMessagesFromJsonRepresentation,
  ExtensionsInput,
  CopilotRuntimeClient,
  langGraphInterruptEvent,
} from "@copilotkit/runtime-client-gql";

import { CopilotApiConfig } from "../context";
import { FrontendAction, processActionsForRuntimeRequest } from "../types/frontend-action";
import { CoagentState } from "../types/coagent-state";
import { AgentSession } from "../context/copilot-context";
import { useCopilotRuntimeClient } from "./use-copilot-runtime-client";
import { useAsyncCallback, useErrorToast } from "../components/error-boundary/error-utils";
import {
  LangGraphInterruptAction,
  LangGraphInterruptActionSetter,
} from "../types/interrupt-action";
import { MetaEvent, MetaEventName } from "@copilotkit/runtime-client-gql";

export type UseChatOptions = {
  /**
   * System messages of the chat. Defaults to an empty array.
   */
  initialMessages?: Message[];
  /**
   * Callback function to be called when a function call is received.
   * If the function returns a `ChatRequest` object, the request will be sent
   * automatically to the API and will be used to update the chat.
   */
  onFunctionCall?: FunctionCallHandler;

  /**
   * Callback function to be called when a coagent action is received.
   */
  onCoAgentStateRender?: CoAgentStateRenderHandler;

  /**
   * Function definitions to be sent to the API.
   */
  actions: FrontendAction<any>[];

  /**
   * The CopilotKit API configuration.
   */
  copilotConfig: CopilotApiConfig;

  /**
   * The current list of messages in the chat.
   */
  messages: Message[];
  /**
   * The setState-powered method to update the chat messages.
   */
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;

  /**
   * A callback to get the latest system message.
   */
  makeSystemMessageCallback: () => TextMessage;

  /**
   * Whether the API request is in progress
   */
  isLoading: boolean;

  /**
   * setState-powered method to update the isChatLoading value
   */
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;

  /**
   * The current list of coagent states.
   */
  coagentStatesRef: React.RefObject<Record<string, CoagentState>>;

  /**
   * setState-powered method to update the agent states
   */
  setCoagentStatesWithRef: React.Dispatch<React.SetStateAction<Record<string, CoagentState>>>;

  /**
   * The current agent session.
   */
  agentSession: AgentSession | null;

  /**
   * setState-powered method to update the agent session
   */
  setAgentSession: React.Dispatch<React.SetStateAction<AgentSession | null>>;

  /**
   * The forwarded parameters.
   */
  forwardedParameters?: Pick<ForwardedParametersInput, "temperature">;

  /**
   * The current thread ID.
   */
  threadId: string;
  /**
   * set the current thread ID
   */
  setThreadId: (threadId: string) => void;
  /**
   * The current run ID.
   */
  runId: string | null;
  /**
   * set the current run ID
   */
  setRunId: (runId: string | null) => void;
  /**
   * The global chat abort controller.
   */
  chatAbortControllerRef: React.MutableRefObject<AbortController | null>;
  /**
   * The agent lock.
   */
  agentLock: string | null;
  /**
   * The extensions.
   */
  extensions: ExtensionsInput;
  /**
   * The setState-powered method to update the extensions.
   */
  setExtensions: React.Dispatch<React.SetStateAction<ExtensionsInput>>;

  langGraphInterruptAction: LangGraphInterruptAction | null;

  setLangGraphInterruptAction: LangGraphInterruptActionSetter;
};

export type UseChatHelpers = {
  /**
   * Append a user message to the chat list. This triggers the API call to fetch
   * the assistant's response.
   * @param message The message to append
   */
  append: (message: Message, options?: AppendMessageOptions) => Promise<void>;
  /**
   * Reload the last AI chat response for the given chat history. If the last
   * message isn't from the assistant, it will request the API to generate a
   * new response.
   */
  reload: () => Promise<void>;
  /**
   * Abort the current request immediately, keep the generated tokens if any.
   */
  stop: () => void;

  /**
   * Run the chat completion.
   */
  runChatCompletion: () => Promise<Message[]>;
};

export interface AppendMessageOptions {
  /**
   * Whether to run the chat completion after appending the message. Defaults to `true`.
   */
  followUp?: boolean;
}

export function useChat(options: UseChatOptions): UseChatHelpers {
  const {
    messages,
    setMessages,
    makeSystemMessageCallback,
    copilotConfig,
    setIsLoading,
    initialMessages,
    isLoading,
    actions,
    onFunctionCall,
    onCoAgentStateRender,
    setCoagentStatesWithRef,
    coagentStatesRef,
    agentSession,
    setAgentSession,
    threadId,
    setThreadId,
    runId,
    setRunId,
    chatAbortControllerRef,
    agentLock,
    extensions,
    setExtensions,
    langGraphInterruptAction,
    setLangGraphInterruptAction,
  } = options;
  const runChatCompletionRef = useRef<(previousMessages: Message[]) => Promise<Message[]>>();
  const addErrorToast = useErrorToast();
  // We need to keep a ref of coagent states and session because of renderAndWait - making sure
  // the latest state is sent to the API
  // This is a workaround and needs to be addressed in the future
  const agentSessionRef = useRef<AgentSession | null>(agentSession);
  agentSessionRef.current = agentSession;

  const runIdRef = useRef<string | null>(runId);
  runIdRef.current = runId;
  const extensionsRef = useRef<ExtensionsInput>(extensions);
  extensionsRef.current = extensions;

  const publicApiKey = copilotConfig.publicApiKey;

  const headers = {
    ...(copilotConfig.headers || {}),
    ...(publicApiKey ? { [COPILOT_CLOUD_PUBLIC_API_KEY_HEADER]: publicApiKey } : {}),
  };

  const runtimeClient = useCopilotRuntimeClient({
    url: copilotConfig.chatApiEndpoint,
    publicApiKey: copilotConfig.publicApiKey,
    headers,
    credentials: copilotConfig.credentials,
  });

  const runChatCompletion = useAsyncCallback(
    async (previousMessages: Message[]): Promise<Message[]> => {
      setIsLoading(true);

      // this message is just a placeholder. It will disappear once the first real message
      // is received
      let newMessages: Message[] = [
        new TextMessage({
          content: "",
          role: Role.Assistant,
        }),
      ];

      chatAbortControllerRef.current = new AbortController();

      setMessages([...previousMessages, ...newMessages]);

      const systemMessage = makeSystemMessageCallback();

      const messagesWithContext = [systemMessage, ...(initialMessages || []), ...previousMessages];

      const isAgentRun = agentSessionRef.current !== null;

      const stream = runtimeClient.asStream(
        runtimeClient.generateCopilotResponse({
          data: {
            frontend: {
              actions: processActionsForRuntimeRequest(actions),
              url: window.location.href,
            },
            threadId: threadId,
            runId: runIdRef.current,
            extensions: extensionsRef.current,
            metaEvents: composeAndFlushMetaEventsInput([langGraphInterruptAction?.event]),
            messages: convertMessagesToGqlInput(filterAgentStateMessages(messagesWithContext)),
            ...(copilotConfig.cloud
              ? {
                  cloud: {
                    ...(copilotConfig.cloud.guardrails?.input?.restrictToTopic?.enabled
                      ? {
                          guardrails: {
                            inputValidationRules: {
                              allowList:
                                copilotConfig.cloud.guardrails.input.restrictToTopic.validTopics,
                              denyList:
                                copilotConfig.cloud.guardrails.input.restrictToTopic.invalidTopics,
                            },
                          },
                        }
                      : {}),
                  },
                }
              : {}),
            metadata: {
              requestType: CopilotRequestType.Chat,
            },
            ...(agentSessionRef.current
              ? {
                  agentSession: agentSessionRef.current,
                }
              : {}),
            agentStates: Object.values(coagentStatesRef.current!).map((state) => ({
              agentName: state.name,
              state: JSON.stringify(state.state),
            })),
            forwardedParameters: options.forwardedParameters || {},
          },
          properties: copilotConfig.properties,
          signal: chatAbortControllerRef.current?.signal,
        }),
      );

      const guardrailsEnabled =
        copilotConfig.cloud?.guardrails?.input?.restrictToTopic.enabled || false;

      const reader = stream.getReader();

      let executedCoAgentStateRenders: string[] = [];
      let followUp: FrontendAction["followUp"] = undefined;

      let messages: Message[] = [];
      let syncedMessages: Message[] = [];

      try {
        while (true) {
          let done, value;

          try {
            const readResult = await reader.read();
            done = readResult.done;
            value = readResult.value;
          } catch (readError) {
            break;
          }

          if (done) {
            if (chatAbortControllerRef.current.signal.aborted) {
              return [];
            }
            break;
          }

          if (!value?.generateCopilotResponse) {
            continue;
          }

          runIdRef.current = value.generateCopilotResponse.runId || null;

          // in the output, graphql inserts __typename, which leads to an error when sending it along
          // as input to the next request.
          extensionsRef.current = CopilotRuntimeClient.removeGraphQLTypename(
            value.generateCopilotResponse.extensions || {},
          );

          // setThreadId(threadIdRef.current);
          setRunId(runIdRef.current);
          setExtensions(extensionsRef.current);

          messages = convertGqlOutputToMessages(
            filterAdjacentAgentStateMessages(value.generateCopilotResponse.messages),
          );

          (value.generateCopilotResponse?.metaEvents ?? []).forEach((ev) => {
            if (ev.name === "LangGraphInterruptEvent") {
              setLangGraphInterruptAction({
                event: langGraphInterruptEvent(ev),
              });
            }
          });

          if (messages.length === 0) {
            continue;
          }

          newMessages = [];

          // request failed, display error message and quit
          if (
            value.generateCopilotResponse.status?.__typename === "FailedResponseStatus" &&
            value.generateCopilotResponse.status.reason === "GUARDRAILS_VALIDATION_FAILED"
          ) {
            newMessages = [
              new TextMessage({
                role: MessageRole.Assistant,
                content: value.generateCopilotResponse.status.details?.guardrailsReason || "",
              }),
            ];
            setMessages([...previousMessages, ...newMessages]);
            break;
          }

          // add messages to the chat
          else {
            newMessages = [...messages];

            for (const message of messages) {
              // execute onCoAgentStateRender handler
              if (
                message.isAgentStateMessage() &&
                !message.active &&
                !executedCoAgentStateRenders.includes(message.id) &&
                onCoAgentStateRender
              ) {
                // Do not execute a coagent action if guardrails are enabled but the status is not known
                if (guardrailsEnabled && value.generateCopilotResponse.status === undefined) {
                  break;
                }
                // execute coagent action
                await onCoAgentStateRender({
                  name: message.agentName,
                  nodeName: message.nodeName,
                  state: message.state,
                });
                executedCoAgentStateRenders.push(message.id);
              }
            }

            const lastAgentStateMessage = [...messages]
              .reverse()
              .find((message) => message.isAgentStateMessage());

            if (lastAgentStateMessage) {
              if (
                lastAgentStateMessage.state.messages &&
                lastAgentStateMessage.state.messages.length > 0
              ) {
                syncedMessages = loadMessagesFromJsonRepresentation(
                  lastAgentStateMessage.state.messages,
                );
              }
              setCoagentStatesWithRef((prevAgentStates) => ({
                ...prevAgentStates,
                [lastAgentStateMessage.agentName]: {
                  name: lastAgentStateMessage.agentName,
                  state: lastAgentStateMessage.state,
                  running: lastAgentStateMessage.running,
                  active: lastAgentStateMessage.active,
                  threadId: lastAgentStateMessage.threadId,
                  nodeName: lastAgentStateMessage.nodeName,
                  runId: lastAgentStateMessage.runId,
                },
              }));
              if (lastAgentStateMessage.running) {
                setAgentSession({
                  threadId: lastAgentStateMessage.threadId,
                  agentName: lastAgentStateMessage.agentName,
                  nodeName: lastAgentStateMessage.nodeName,
                });
              } else {
                if (agentLock) {
                  setAgentSession({
                    threadId: randomId(),
                    agentName: agentLock,
                    nodeName: undefined,
                  });
                } else {
                  setAgentSession(null);
                }
              }
            }
          }

          if (newMessages.length > 0) {
            // Update message state
            setMessages([...previousMessages, ...newMessages]);
          }
        }
        const finalMessages = constructFinalMessages(syncedMessages, previousMessages, newMessages);

        let didExecuteAction = false;

        // execute regular action executions that are specific to the frontend (last actions)
        if (onFunctionCall) {
          // Find consecutive action execution messages at the end
          const lastMessages = [];
          for (let i = finalMessages.length - 1; i >= 0; i--) {
            const message = finalMessages[i];
            if (
              message.isActionExecutionMessage() &&
              message.status.code !== MessageStatusCode.Pending
            ) {
              lastMessages.unshift(message);
            } else {
              break;
            }
          }

          for (const message of lastMessages) {
            // We update the message state before calling the handler so that the render
            // function can be called with `executing` state
            setMessages(finalMessages);

            const action = actions.find((action) => action.name === message.name);

            if (action) {
              followUp = action.followUp;
              let result: any;
              let error: Error | null = null;
              try {
                result = await Promise.race([
                  onFunctionCall({
                    messages: previousMessages,
                    name: message.name,
                    args: message.arguments,
                  }),
                  new Promise((resolve) =>
                    chatAbortControllerRef.current?.signal.addEventListener("abort", () =>
                      resolve("Operation was aborted by the user"),
                    ),
                  ),
                  // if the user stopped generation, we also abort consecutive actions
                  new Promise((resolve) => {
                    if (chatAbortControllerRef.current?.signal.aborted) {
                      resolve("Operation was aborted by the user");
                    }
                  }),
                ]);
              } catch (e) {
                error = e as Error;
                addErrorToast([error]);
                result = `Failed to execute action ${message.name}. ${error.message}`;
                console.error(`Failed to execute action ${message.name}: ${error}`);
              }
              didExecuteAction = true;
              const messageIndex = finalMessages.findIndex((msg) => msg.id === message.id);
              finalMessages.splice(
                messageIndex + 1,
                0,
                new ResultMessage({
                  id: "result-" + message.id,
                  result: ResultMessage.encodeResult(
                    error
                      ? {
                          content: result,
                          error: JSON.parse(
                            JSON.stringify(error, Object.getOwnPropertyNames(error)),
                          ),
                        }
                      : result,
                  ),
                  actionExecutionId: message.id,
                  actionName: message.name,
                }),
              );
            }
          }

          setMessages(finalMessages);
        }

        if (
          // if followUp is not explicitly false
          followUp !== false &&
          // and we executed an action
          (didExecuteAction ||
            // the last message is a server side result
            (!isAgentRun &&
              finalMessages.length &&
              finalMessages[finalMessages.length - 1].isResultMessage())) &&
          // the user did not stop generation
          !chatAbortControllerRef.current?.signal.aborted
        ) {
          // run the completion again and return the result

          // wait for next tick to make sure all the react state updates
          // - tried using react-dom's flushSync, but it did not work
          await new Promise((resolve) => setTimeout(resolve, 10));

          return await runChatCompletionRef.current!(finalMessages);
        } else if (chatAbortControllerRef.current?.signal.aborted) {
          // filter out all the action execution messages that do not have a consecutive matching result message
          const repairedMessages = finalMessages.filter((message, actionExecutionIndex) => {
            if (message.isActionExecutionMessage()) {
              return finalMessages.find(
                (msg, resultIndex) =>
                  msg.isResultMessage() &&
                  msg.actionExecutionId === message.id &&
                  resultIndex === actionExecutionIndex + 1,
              );
            }
            return true;
          });
          const repairedMessageIds = repairedMessages.map((message) => message.id);
          setMessages(repairedMessages);

          // LangGraph needs two pieces of information to continue execution:
          // 1. The threadId
          // 2. The nodeName it came from
          // When stopping the agent, we don't know the nodeName the agent would have ended with
          // Therefore, we set the nodeName to the most reasonable thing we can guess, which
          // is "__end__"
          if (agentSessionRef.current?.nodeName) {
            setAgentSession({
              threadId: agentSessionRef.current.threadId,
              agentName: agentSessionRef.current.agentName,
              nodeName: "__end__",
            });
          }
          // only return new messages that were not filtered out
          return newMessages.filter((message) => repairedMessageIds.includes(message.id));
        } else {
          return newMessages.slice();
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      messages,
      setMessages,
      makeSystemMessageCallback,
      copilotConfig,
      setIsLoading,
      initialMessages,
      isLoading,
      actions,
      onFunctionCall,
      onCoAgentStateRender,
      setCoagentStatesWithRef,
      coagentStatesRef,
      agentSession,
      setAgentSession,
    ],
  );

  runChatCompletionRef.current = runChatCompletion;

  const runChatCompletionAndHandleFunctionCall = useAsyncCallback(
    async (messages: Message[]): Promise<void> => {
      await runChatCompletionRef.current!(messages);
    },
    [messages],
  );

  // Go over all events and see that they include data that should be returned to the agent
  const composeAndFlushMetaEventsInput = useCallback(
    (metaEvents: (MetaEvent | undefined | null)[]) => {
      return metaEvents.reduce((acc: MetaEvent[], event) => {
        if (!event) return acc;

        switch (event.name) {
          case MetaEventName.LangGraphInterruptEvent:
            if (event.response) {
              // Flush interrupt event from state
              setLangGraphInterruptAction(null);
              return [
                ...acc,
                {
                  type: event.type,
                  name: event.name,
                  value: event.value,
                  response: event.response,
                },
              ];
            }
            return acc;
          default:
            return acc;
        }
      }, []);
    },
    [setLangGraphInterruptAction],
  );

  const append = useAsyncCallback(
    async (message: Message, options?: AppendMessageOptions): Promise<void> => {
      if (isLoading) {
        return;
      }

      const newMessages = [...messages, message];
      setMessages(newMessages);
      const followUp = options?.followUp ?? true;
      if (followUp) {
        return runChatCompletionAndHandleFunctionCall(newMessages);
      }
    },
    [isLoading, messages, setMessages, runChatCompletionAndHandleFunctionCall],
  );

  const reload = useAsyncCallback(async (): Promise<void> => {
    if (isLoading || messages.length === 0) {
      return;
    }
    let newMessages = [...messages];
    const lastMessage = messages[messages.length - 1];

    if (lastMessage.isTextMessage() && lastMessage.role === "assistant") {
      newMessages = newMessages.slice(0, -1);
    }

    setMessages(newMessages);

    return runChatCompletionAndHandleFunctionCall(newMessages);
  }, [isLoading, messages, setMessages, runChatCompletionAndHandleFunctionCall]);

  const stop = (): void => {
    chatAbortControllerRef.current?.abort("Stop was called");
  };

  return {
    append,
    reload,
    stop,
    runChatCompletion: () => runChatCompletionRef.current!(messages),
  };
}

function constructFinalMessages(
  syncedMessages: Message[],
  previousMessages: Message[],
  newMessages: Message[],
): Message[] {
  const finalMessages =
    syncedMessages.length > 0 ? [...syncedMessages] : [...previousMessages, ...newMessages];

  if (syncedMessages.length > 0) {
    const messagesWithAgentState = [...previousMessages, ...newMessages];

    let previousMessageId: string | undefined = undefined;

    for (const message of messagesWithAgentState) {
      if (message.isAgentStateMessage()) {
        // insert this message into finalMessages after the position of previousMessageId
        const index = finalMessages.findIndex((msg) => msg.id === previousMessageId);
        if (index !== -1) {
          finalMessages.splice(index + 1, 0, message);
        }
      }

      previousMessageId = message.id;
    }
  }

  return finalMessages;
}
