/**
 * <Callout type="info">
 *   Usage of this hook assumes some additional setup in your application, for more information
 *   on that see the CoAgents <span className="text-blue-500">[getting started guide](/coagents/quickstart/langgraph)</span>.
 * </Callout>
 * <Frame className="my-12">
 *   <img
 *     src="/images/coagents/SharedStateCoAgents.gif"
 *     alt="CoAgents demonstration"
 *     className="w-auto"
 *   />
 * </Frame>
 *
 * This hook is used to integrate an agent into your application. With its use, you can
 * render and update the state of an agent, allowing for a dynamic and interactive experience.
 * We call these shared state experiences agentic copilots, or CoAgents for short.
 *
 * ## Usage
 *
 * ### Simple Usage
 *
 * ```tsx
 * import { useCoAgent } from "@copilotkit/react-core";
 *
 * type AgentState = {
 *   count: number;
 * }
 *
 * const agent = useCoAgent<AgentState>({
 *   name: "my-agent",
 *   initialState: {
 *     count: 0,
 *   },
 * });
 *
 * ```
 *
 * `useCoAgent` returns an object with the following properties:
 *
 * ```tsx
 * const {
 *   name,     // The name of the agent currently being used.
 *   nodeName, // The name of the current LangGraph node.
 *   state,    // The current state of the agent.
 *   setState, // A function to update the state of the agent.
 *   running,  // A boolean indicating if the agent is currently running.
 *   start,    // A function to start the agent.
 *   stop,     // A function to stop the agent.
 *   run,      // A function to re-run the agent. Takes a HintFunction to inform the agent why it is being re-run.
 * } = agent;
 * ```
 *
 * Finally we can leverage these properties to create reactive experiences with the agent!
 *
 * ```tsx
 * const { state, setState } = useCoAgent<AgentState>({
 *   name: "my-agent",
 *   initialState: {
 *     count: 0,
 *   },
 * });
 *
 * return (
 *   <div>
 *     <p>Count: {state.count}</p>
 *     <button onClick={() => setState({ count: state.count + 1 })}>Increment</button>
 *   </div>
 * );
 * ```
 *
 * This reactivity is bidirectional, meaning that changes to the state from the agent will be reflected in the UI and vice versa.
 *
 * ## Parameters
 * <PropertyReference name="options" type="UseCoagentOptions<T>" required>
 *   The options to use when creating the coagent.
 *   <PropertyReference name="name" type="string" required>
 *     The name of the agent to use.
 *   </PropertyReference>
 *   <PropertyReference name="initialState" type="T | any">
 *     The initial state of the agent.
 *   </PropertyReference>
 *   <PropertyReference name="state" type="T | any">
 *     State to manage externally if you are using this hook with external state management.
 *   </PropertyReference>
 *   <PropertyReference name="setState" type="(newState: T | ((prevState: T | undefined) => T)) => void">
 *     A function to update the state of the agent if you are using this hook with external state management.
 *   </PropertyReference>
 * </PropertyReference>
 */

import { useEffect, useRef } from "react";
import {
  CopilotContextParams,
  CopilotMessagesContextParams,
  useCopilotContext,
  useCopilotMessagesContext,
} from "../context";
import { CoagentState } from "../types/coagent-state";
import { useCopilotChat } from "./use-copilot-chat";
import { Message } from "@copilotkit/runtime-client-gql";
import { useAsyncCallback } from "../components/error-boundary/error-utils";
import { useToast } from "../components/toast/toast-provider";
import { useCopilotRuntimeClient } from "./use-copilot-runtime-client";

interface WithInternalStateManagementAndInitial<T> {
  /**
   * The name of the agent being used.
   */
  name: string;
  /**
   * The initial state of the agent.
   */
  initialState: T;
}

interface WithInternalStateManagement {
  /**
   * The name of the agent being used.
   */
  name: string;
  /**
   * Optional initialState with default type any
   */
  initialState?: any;
}

interface WithExternalStateManagement<T> {
  /**
   * The name of the agent being used.
   */
  name: string;
  /**
   * The current state of the agent.
   */
  state: T;
  /**
   * A function to update the state of the agent.
   */
  setState: (newState: T | ((prevState: T | undefined) => T)) => void;
}

type UseCoagentOptions<T> =
  | WithInternalStateManagementAndInitial<T>
  | WithInternalStateManagement
  | WithExternalStateManagement<T>;

export interface UseCoagentReturnType<T> {
  /**
   * The name of the agent being used.
   */
  name: string;
  /**
   * The name of the current LangGraph node.
   */
  nodeName?: string;
  /**
   * The ID of the thread the agent is running in.
   */
  threadId?: string;
  /**
   * A boolean indicating if the agent is currently running.
   */
  running: boolean;
  /**
   * The current state of the agent.
   */
  state: T;
  /**
   * A function to update the state of the agent.
   */
  setState: (newState: T | ((prevState: T | undefined) => T)) => void;
  /**
   * A function to start the agent.
   */
  start: () => void;
  /**
   * A function to stop the agent.
   */
  stop: () => void;
  /**
   * A function to re-run the agent. The hint function can be used to provide a hint to the agent
   * about why it is being re-run again.
   */
  run: (hint?: HintFunction) => Promise<void>;
}

export interface HintFunctionParams {
  /**
   * The previous state of the agent.
   */
  previousState: any;
  /**
   * The current state of the agent.
   */
  currentState: any;
}

export type HintFunction = (params: HintFunctionParams) => Message | undefined;

/**
 * This hook is used to integrate an agent into your application. With its use, you can
 * render and update the state of the agent, allowing for a dynamic and interactive experience.
 * We call these shared state experiences "agentic copilots". To get started using agentic copilots, which
 * we refer to as CoAgents, checkout the documentation at https://docs.copilotkit.ai/coagents/quickstart/langgraph.
 */
export function useCoAgent<T = any>(options: UseCoagentOptions<T>): UseCoagentReturnType<T> {
  const generalContext = useCopilotContext();
  const { availableAgents } = generalContext;
  const { addToast } = useToast();
  const lastLoadedThreadId = useRef<string>();
  const lastLoadedState = useRef<any>();

  const isExternalStateManagement = (
    options: UseCoagentOptions<T>,
  ): options is WithExternalStateManagement<T> => {
    return "state" in options && "setState" in options;
  };

  const { name } = options;
  useEffect(() => {
    if (availableAgents?.length && !availableAgents.some((a) => a.name === name)) {
      const message = `(useCoAgent): Agent "${name}" not found. Make sure the agent exists and is properly configured.`;
      console.warn(message);
      addToast({ type: "warning", message });
    }
  }, [availableAgents]);

  const isInternalStateManagementWithInitial = (
    options: UseCoagentOptions<T>,
  ): options is WithInternalStateManagementAndInitial<T> => {
    return "initialState" in options;
  };

  const messagesContext = useCopilotMessagesContext();
  const context = { ...generalContext, ...messagesContext };
  const { coagentStates, coagentStatesRef, setCoagentStatesWithRef, threadId, copilotApiConfig } =
    context;
  const { appendMessage, runChatCompletion } = useCopilotChat();

  const getCoagentState = (coagentStates: Record<string, CoagentState>, name: string) => {
    if (coagentStates[name]) {
      return coagentStates[name];
    } else {
      return {
        name,
        state: isInternalStateManagementWithInitial(options) ? options.initialState : {},
        running: false,
        active: false,
        threadId: undefined,
        nodeName: undefined,
        runId: undefined,
      };
    }
  };

  const runtimeClient = useCopilotRuntimeClient({
    url: copilotApiConfig.chatApiEndpoint,
    publicApiKey: copilotApiConfig.publicApiKey,
    credentials: copilotApiConfig.credentials,
  });

  // if we manage state internally, we need to provide a function to set the state
  const setState = (newState: T | ((prevState: T | undefined) => T)) => {
    let coagentState: CoagentState = getCoagentState(coagentStatesRef.current || {}, name);
    const updatedState =
      typeof newState === "function" ? (newState as Function)(coagentState.state) : newState;

    setCoagentStatesWithRef({
      ...coagentStatesRef.current,
      [name]: {
        ...coagentState,
        state: updatedState,
      },
    });
  };

  useEffect(() => {
    const fetchAgentState = async () => {
      if (!threadId || threadId === lastLoadedThreadId.current) return;

      const result = await runtimeClient.loadAgentState({
        threadId,
        agentName: name,
      });

      const newState = result.data?.loadAgentState?.state;
      if (newState === lastLoadedState.current) return;

      if (result.data?.loadAgentState?.threadExists && newState && newState != "{}") {
        lastLoadedState.current = newState;
        lastLoadedThreadId.current = threadId;
        const fetchedState = JSON.parse(newState);
        isExternalStateManagement(options)
          ? options.setState(fetchedState)
          : setState(fetchedState);
      }
    };
    void fetchAgentState();
  }, [threadId]);

  const coagentState = getCoagentState(coagentStates, name);

  // Sync internal state with external state if state management is external
  useEffect(() => {
    if (isExternalStateManagement(options)) {
      setState(options.state);
    } else if (coagentStates[name] === undefined) {
      setState(options.initialState === undefined ? {} : options.initialState);
    }
  }, [
    isExternalStateManagement(options) ? JSON.stringify(options.state) : undefined,
    // reset initialstate on reset
    coagentStates[name] === undefined,
  ]);

  const runAgentCallback = useAsyncCallback(
    async (hint?: HintFunction) => {
      await runAgent(name, context, appendMessage, runChatCompletion, hint);
    },
    [name, context, appendMessage, runChatCompletion],
  );

  // Return the state and setState function
  return {
    name,
    nodeName: coagentState.nodeName,
    threadId: coagentState.threadId,
    running: coagentState.running,
    state: coagentState.state,
    setState: isExternalStateManagement(options) ? options.setState : setState,
    start: () => startAgent(name, context),
    stop: () => stopAgent(name, context),
    run: runAgentCallback,
  };
}

export function startAgent(name: string, context: CopilotContextParams) {
  const { setAgentSession } = context;
  setAgentSession({
    agentName: name,
  });
}

export function stopAgent(name: string, context: CopilotContextParams) {
  const { agentSession, setAgentSession } = context;
  if (agentSession && agentSession.agentName === name) {
    setAgentSession(null);
    context.setCoagentStates((prevAgentStates) => {
      return {
        ...prevAgentStates,
        [name]: {
          ...prevAgentStates[name],
          running: false,
          active: false,
          threadId: undefined,
          nodeName: undefined,
          runId: undefined,
        },
      };
    });
  } else {
    console.warn(`No agent session found for ${name}`);
  }
}

export async function runAgent(
  name: string,
  context: CopilotContextParams & CopilotMessagesContextParams,
  appendMessage: (message: Message) => Promise<void>,
  runChatCompletion: () => Promise<Message[]>,
  hint?: HintFunction,
) {
  const { agentSession, setAgentSession } = context;
  if (!agentSession || agentSession.agentName !== name) {
    setAgentSession({
      agentName: name,
    });
  }

  let previousState: any = null;
  for (let i = context.messages.length - 1; i >= 0; i--) {
    const message = context.messages[i];
    if (message.isAgentStateMessage() && message.agentName === name) {
      previousState = message.state;
    }
  }

  let state = context.coagentStatesRef.current?.[name]?.state || {};

  if (hint) {
    const hintMessage = hint({ previousState, currentState: state });
    if (hintMessage) {
      await appendMessage(hintMessage);
    } else {
      await runChatCompletion();
    }
  } else {
    await runChatCompletion();
  }
}
