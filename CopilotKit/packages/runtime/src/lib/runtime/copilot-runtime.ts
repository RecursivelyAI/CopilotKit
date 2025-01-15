/**
 * <Callout type="info">
 *   This is the reference for the `CopilotRuntime` class. For more information and example code snippets, please see [Concept: Copilot Runtime](/concepts/copilot-runtime).
 * </Callout>
 *
 * ## Usage
 *
 * ```tsx
 * import { CopilotRuntime } from "@copilotkit/runtime";
 *
 * const copilotKit = new CopilotRuntime();
 * ```
 */

import { Action, actionParametersToJsonSchema, Parameter, randomId } from "@copilotkit/shared";
import { CopilotServiceAdapter, RemoteChain, RemoteChainParameters } from "../../service-adapters";
import { MessageInput } from "../../graphql/inputs/message.input";
import { ActionInput } from "../../graphql/inputs/action.input";
import { RuntimeEventSource } from "../../service-adapters/events";
import { convertGqlInputToMessages } from "../../service-adapters/conversion";
import { Message } from "../../graphql/types/converted";
import { ForwardedParametersInput } from "../../graphql/inputs/forwarded-parameters.input";
import {
  isLangGraphAgentAction,
  LangGraphAgentAction,
  EndpointType,
  setupRemoteActions,
  EndpointDefinition,
  CopilotKitEndpoint,
  LangGraphPlatformEndpoint,
} from "./remote-actions";
import { GraphQLContext } from "../integrations/shared";
import { AgentSessionInput } from "../../graphql/inputs/agent-session.input";
import { from } from "rxjs";
import { AgentStateInput } from "../../graphql/inputs/agent-state.input";
import { ActionInputAvailability } from "../../graphql/types/enums";
import { createHeaders } from "./remote-action-constructors";
import { Agent } from "../../graphql/types/agents-response.type";
import { ExtensionsInput } from "../../graphql/inputs/extensions.input";
import { ExtensionsResponse } from "../../graphql/types/extensions-response.type";

interface CopilotRuntimeRequest {
  serviceAdapter: CopilotServiceAdapter;
  messages: MessageInput[];
  actions: ActionInput[];
  agentSession?: AgentSessionInput;
  agentStates?: AgentStateInput[];
  outputMessagesPromise: Promise<Message[]>;
  threadId?: string;
  runId?: string;
  publicApiKey?: string;
  graphqlContext: GraphQLContext;
  forwardedParameters?: ForwardedParametersInput;
  url?: string;
  extensions?: ExtensionsInput;
}

interface CopilotRuntimeResponse {
  threadId: string;
  runId?: string;
  eventSource: RuntimeEventSource;
  serverSideActions: Action<any>[];
  actionInputsWithoutAgents: ActionInput[];
  extensions?: ExtensionsResponse;
}

type ActionsConfiguration<T extends Parameter[] | [] = []> =
  | Action<T>[]
  | ((ctx: { properties: any; url?: string }) => Action<T>[]);

interface OnBeforeRequestOptions {
  threadId?: string;
  runId?: string;
  inputMessages: Message[];
  properties: any;
  url?: string;
}

type OnBeforeRequestHandler = (options: OnBeforeRequestOptions) => void | Promise<void>;

interface OnAfterRequestOptions {
  threadId: string;
  runId?: string;
  inputMessages: Message[];
  outputMessages: Message[];
  properties: any;
  url?: string;
}

type OnAfterRequestHandler = (options: OnAfterRequestOptions) => void | Promise<void>;

interface Middleware {
  /**
   * A function that is called before the request is processed.
   */
  onBeforeRequest?: OnBeforeRequestHandler;

  /**
   * A function that is called after the request is processed.
   */
  onAfterRequest?: OnAfterRequestHandler;
}

export interface CopilotRuntimeConstructorParams<T extends Parameter[] | [] = []> {
  /**
   * Middleware to be used by the runtime.
   *
   * ```ts
   * onBeforeRequest: (options: {
   *   threadId?: string;
   *   runId?: string;
   *   inputMessages: Message[];
   *   properties: any;
   * }) => void | Promise<void>;
   * ```
   *
   * ```ts
   * onAfterRequest: (options: {
   *   threadId?: string;
   *   runId?: string;
   *   inputMessages: Message[];
   *   outputMessages: Message[];
   *   properties: any;
   * }) => void | Promise<void>;
   * ```
   */
  middleware?: Middleware;

  /*
   * A list of server side actions that can be executed.
   */
  actions?: ActionsConfiguration<T>;

  /*
   * Deprecated: Use `remoteEndpoints`.
   */
  remoteActions?: CopilotKitEndpoint[];

  /*
   * A list of remote actions that can be executed.
   */
  remoteEndpoints?: EndpointDefinition[];

  /*
   * An array of LangServer URLs.
   */
  langserve?: RemoteChainParameters[];
}

export class CopilotRuntime<const T extends Parameter[] | [] = []> {
  public actions: ActionsConfiguration<T>;
  public remoteEndpointDefinitions: EndpointDefinition[];
  private langserve: Promise<Action<any>>[] = [];
  private onBeforeRequest?: OnBeforeRequestHandler;
  private onAfterRequest?: OnAfterRequestHandler;

  constructor(params?: CopilotRuntimeConstructorParams<T>) {
    this.actions = params?.actions || [];

    for (const chain of params?.langserve || []) {
      const remoteChain = new RemoteChain(chain);
      this.langserve.push(remoteChain.toAction());
    }

    this.remoteEndpointDefinitions = params?.remoteEndpoints ?? params?.remoteActions ?? [];

    this.onBeforeRequest = params?.middleware?.onBeforeRequest;
    this.onAfterRequest = params?.middleware?.onAfterRequest;
  }

  async processRuntimeRequest(request: CopilotRuntimeRequest): Promise<CopilotRuntimeResponse> {
    const {
      serviceAdapter,
      messages: rawMessages,
      actions: clientSideActionsInput,
      threadId,
      runId,
      outputMessagesPromise,
      graphqlContext,
      forwardedParameters,
      agentSession,
      url,
      extensions,
    } = request;

    const eventSource = new RuntimeEventSource();

    try {
      if (agentSession) {
        return await this.processAgentRequest(request);
      }

      const messages = rawMessages.filter((message) => !message.agentStateMessage);

      const inputMessages = convertGqlInputToMessages(messages);
      const serverSideActions = await this.getServerSideActions(request);

      const serverSideActionsInput: ActionInput[] = serverSideActions.map((action) => ({
        name: action.name,
        description: action.description,
        jsonSchema: JSON.stringify(actionParametersToJsonSchema(action.parameters)),
      }));

      const actionInputs = flattenToolCallsNoDuplicates([
        ...serverSideActionsInput,
        ...clientSideActionsInput.filter(
          // Filter remote actions from CopilotKit core loop
          (action) => action.available !== ActionInputAvailability.remote,
        ),
      ]);

      await this.onBeforeRequest?.({
        threadId,
        runId,
        inputMessages,
        properties: graphqlContext.properties,
        url,
      });

      const result = await serviceAdapter.process({
        messages: inputMessages,
        actions: actionInputs,
        threadId,
        runId,
        eventSource,
        forwardedParameters,
        extensions,
      });

      outputMessagesPromise
        .then((outputMessages) => {
          this.onAfterRequest?.({
            threadId: result.threadId,
            runId: result.runId,
            inputMessages,
            outputMessages,
            properties: graphqlContext.properties,
            url,
          });
        })
        .catch((_error) => {});

      return {
        threadId: result.threadId,
        runId: result.runId,
        eventSource,
        serverSideActions,
        actionInputsWithoutAgents: actionInputs.filter(
          (action) =>
            // TODO-AGENTS: do not exclude ALL server side actions
            !serverSideActions.find((serverSideAction) => serverSideAction.name == action.name),
          // !isLangGraphAgentAction(
          //   serverSideActions.find((serverSideAction) => serverSideAction.name == action.name),
          // ),
        ),
        extensions: result.extensions,
      };
    } catch (error) {
      console.error("Error getting response:", error);
      eventSource.sendErrorMessageToChat();
      throw error;
    }
  }

  async discoverAgentsFromEndpoints(graphqlContext: GraphQLContext): Promise<Agent[]> {
    const headers = createHeaders(null, graphqlContext);
    const agents = this.remoteEndpointDefinitions.reduce(
      async (acc: Promise<Agent[]>, endpoint) => {
        const agents = await acc;
        if (endpoint.type === EndpointType.LangGraphPlatform) {
          const response = await fetch(
            `${(endpoint as LangGraphPlatformEndpoint).deploymentUrl}/assistants/search`,
            {
              method: "POST",
              headers,
            },
          );

          const data: Array<{ assistant_id: string; graph_id: string }> = await response.json();
          const endpointAgents = (data ?? []).map((entry) => ({
            name: entry.graph_id,
            id: entry.assistant_id,
          }));
          return [...agents, ...endpointAgents];
        }

        interface InfoResponse {
          agents?: Array<{
            name: string;
            description: string;
          }>;
        }

        const response = await fetch(`${(endpoint as CopilotKitEndpoint).url}/info`, {
          method: "POST",
          headers,
          body: JSON.stringify({ properties: graphqlContext.properties }),
        });
        const data: InfoResponse = await response.json();
        const endpointAgents = (data?.agents ?? []).map((agent) => ({
          name: agent.name,
          description: agent.description,
          id: randomId(), // Required by Agent type
        }));
        return [...agents, ...endpointAgents];
      },
      Promise.resolve([]),
    );

    return agents;
  }

  private async processAgentRequest(
    request: CopilotRuntimeRequest,
  ): Promise<CopilotRuntimeResponse> {
    const { messages: rawMessages, outputMessagesPromise, graphqlContext, agentSession } = request;
    const { threadId, agentName, nodeName } = agentSession;
    const serverSideActions = await this.getServerSideActions(request);

    const messages = convertGqlInputToMessages(rawMessages);

    const agent = serverSideActions.find(
      (action) => action.name === agentName && isLangGraphAgentAction(action),
    ) as LangGraphAgentAction;

    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    const serverSideActionsInput: ActionInput[] = serverSideActions
      .filter((action) => !isLangGraphAgentAction(action))
      .map((action) => ({
        name: action.name,
        description: action.description,
        jsonSchema: JSON.stringify(actionParametersToJsonSchema(action.parameters)),
      }));

    const actionInputsWithoutAgents = flattenToolCallsNoDuplicates([
      ...serverSideActionsInput,
      ...request.actions,
    ]);

    await this.onBeforeRequest?.({
      threadId,
      runId: undefined,
      inputMessages: messages,
      properties: graphqlContext.properties,
    });
    try {
      const eventSource = new RuntimeEventSource();
      const stream = await agent.langGraphAgentHandler({
        name: agentName,
        threadId,
        nodeName,
        actionInputsWithoutAgents,
      });

      eventSource.stream(async (eventStream$) => {
        from(stream).subscribe({
          next: (event) => eventStream$.next(event),
          error: (err) => {
            console.error("Error in stream", err);
            eventStream$.error(err);
            eventStream$.complete();
          },
          complete: () => eventStream$.complete(),
        });
      });

      outputMessagesPromise
        .then((outputMessages) => {
          this.onAfterRequest?.({
            threadId,
            runId: undefined,
            inputMessages: messages,
            outputMessages,
            properties: graphqlContext.properties,
          });
        })
        .catch((_error) => {});

      return {
        threadId,
        runId: undefined,
        eventSource,
        serverSideActions: [],
        actionInputsWithoutAgents,
      };
    } catch (error) {
      console.error("Error getting response:", error);
      throw error;
    }
  }

  private async getServerSideActions(request: CopilotRuntimeRequest): Promise<Action<any>[]> {
    const { messages: rawMessages, graphqlContext, agentStates, url } = request;
    const inputMessages = convertGqlInputToMessages(rawMessages);
    const langserveFunctions: Action<any>[] = [];

    for (const chainPromise of this.langserve) {
      try {
        const chain = await chainPromise;
        langserveFunctions.push(chain);
      } catch (error) {
        console.error("Error loading langserve chain:", error);
      }
    }

    const remoteEndpointDefinitions = this.remoteEndpointDefinitions.map(
      (endpoint) =>
        ({
          ...endpoint,
          type: resolveEndpointType(endpoint),
        }) as EndpointDefinition,
    );

    const remoteActions = await setupRemoteActions({
      remoteEndpointDefinitions,
      graphqlContext,
      messages: inputMessages,
      agentStates,
      frontendUrl: url,
    });

    const configuredActions =
      typeof this.actions === "function"
        ? this.actions({ properties: graphqlContext.properties, url })
        : this.actions;

    return [...configuredActions, ...langserveFunctions, ...remoteActions];
  }
}

export function flattenToolCallsNoDuplicates(toolsByPriority: ActionInput[]): ActionInput[] {
  let allTools: ActionInput[] = [];
  const allToolNames: string[] = [];
  for (const tool of toolsByPriority) {
    if (!allToolNames.includes(tool.name)) {
      allTools.push(tool);
      allToolNames.push(tool.name);
    }
  }
  return allTools;
}

// The two functions below are "factory functions", meant to create the action objects that adhere to the expected interfaces
export function copilotKitEndpoint(config: Omit<CopilotKitEndpoint, "type">): CopilotKitEndpoint {
  return {
    ...config,
    type: EndpointType.CopilotKit,
  };
}

export function langGraphPlatformEndpoint(
  config: Omit<LangGraphPlatformEndpoint, "type">,
): LangGraphPlatformEndpoint {
  return {
    ...config,
    type: EndpointType.LangGraphPlatform,
  };
}

export function resolveEndpointType(endpoint: EndpointDefinition) {
  if (!endpoint.type) {
    if ("langsmithApiKey" in endpoint && "deploymentUrl" in endpoint && "agents" in endpoint) {
      return EndpointType.LangGraphPlatform;
    } else {
      return EndpointType.CopilotKit;
    }
  }

  return endpoint.type;
}
