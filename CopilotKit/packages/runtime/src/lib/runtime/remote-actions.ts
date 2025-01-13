import { Action } from "@copilotkit/shared";
import { GraphQLContext } from "../integrations/shared";
import { Logger } from "pino";
import { Message } from "../../graphql/types/converted";
import { RuntimeEvent } from "../../service-adapters/events";
import { Observable } from "rxjs";
import { ActionInput } from "../../graphql/inputs/action.input";
import { AgentStateInput } from "../../graphql/inputs/agent-state.input";
import {
  constructLGCRemoteAction,
  constructRemoteActions,
  createHeaders,
} from "./remote-action-constructors";
import {
  CopilotKitLowLevelError,
  ResolvedCopilotKitError,
  CopilotKitError,
} from "@copilotkit/shared";

export type EndpointDefinition = CopilotKitEndpoint | LangGraphPlatformEndpoint;

export enum EndpointType {
  CopilotKit = "copilotKit",
  LangGraphPlatform = "langgraph-platform",
}

export interface BaseEndpointDefinition<TActionType extends EndpointType> {
  type?: TActionType;
}

export interface CopilotKitEndpoint extends BaseEndpointDefinition<EndpointType.CopilotKit> {
  url: string;
  onBeforeRequest?: ({ ctx }: { ctx: GraphQLContext }) => {
    headers?: Record<string, string> | undefined;
  };
}

export interface LangGraphPlatformAgent {
  name: string;
  description: string;
  assistantId?: string;
}

export interface LangGraphPlatformEndpoint
  extends BaseEndpointDefinition<EndpointType.LangGraphPlatform> {
  deploymentUrl: string;
  langsmithApiKey: string;
  agents: LangGraphPlatformAgent[];
}

export type RemoteActionInfoResponse = {
  actions: any[];
  agents: any[];
};

export type LangGraphAgentHandlerParams = {
  name: string;
  actionInputsWithoutAgents: ActionInput[];
  threadId?: string;
  nodeName?: string;
  additionalMessages?: Message[];
};

export type LangGraphAgentAction = Action<any> & {
  langGraphAgentHandler: (params: LangGraphAgentHandlerParams) => Promise<Observable<RuntimeEvent>>;
};

export function isLangGraphAgentAction(action: Action<any>): action is LangGraphAgentAction {
  if (!action) {
    return false;
  }
  return typeof (action as LangGraphAgentAction).langGraphAgentHandler === "function";
}

async function fetchRemoteInfo({
  url,
  onBeforeRequest,
  graphqlContext,
  logger,
  frontendUrl,
}: {
  url: string;
  onBeforeRequest?: CopilotKitEndpoint["onBeforeRequest"];
  graphqlContext: GraphQLContext;
  logger: Logger;
  frontendUrl?: string;
}): Promise<RemoteActionInfoResponse> {
  logger.debug({ url }, "Fetching actions from url");
  const headers = createHeaders(onBeforeRequest, graphqlContext);

  const fetchUrl = `${url}/info`;
  try {
    const response = await fetch(fetchUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ properties: graphqlContext.properties, frontendUrl }),
    });

    if (!response.ok) {
      logger.error(
        { url, status: response.status, body: await response.text() },
        "Failed to fetch actions from url",
      );
      throw new ResolvedCopilotKitError({ status: response.status });
    }

    const json = await response.json();
    logger.debug({ json }, "Fetched actions from url");
    return json;
  } catch (error) {
    if (error instanceof CopilotKitError) {
      throw error;
    }
    throw new CopilotKitLowLevelError({ error, url: fetchUrl });
  }
}

export async function setupRemoteActions({
  remoteEndpointDefinitions,
  graphqlContext,
  messages,
  agentStates,
  frontendUrl,
}: {
  remoteEndpointDefinitions: EndpointDefinition[];
  graphqlContext: GraphQLContext;
  messages: Message[];
  agentStates?: AgentStateInput[];
  frontendUrl?: string;
}): Promise<Action[]> {
  const logger = graphqlContext.logger.child({ component: "remote-actions.fetchRemoteActions" });
  logger.debug({ remoteEndpointDefinitions }, "Fetching from remote endpoints");

  // Remove duplicates of remoteEndpointDefinitions.url
  const filtered = remoteEndpointDefinitions.filter((value, index, self) => {
    if (value.type === EndpointType.LangGraphPlatform) {
      return value;
    }
    return index === self.findIndex((t: CopilotKitEndpoint) => t.url === value.url);
  });

  const result = await Promise.all(
    filtered.map(async (endpoint) => {
      // Check for properties that can distinguish LG platform from other actions
      if (endpoint.type === EndpointType.LangGraphPlatform) {
        return constructLGCRemoteAction({
          endpoint,
          messages,
          graphqlContext,
          logger: logger.child({
            component: "remote-actions.constructLGCRemoteAction",
            endpoint,
          }),
          agentStates,
        });
      }

      const json = await fetchRemoteInfo({
        url: endpoint.url,
        onBeforeRequest: endpoint.onBeforeRequest,
        graphqlContext,
        logger: logger.child({ component: "remote-actions.fetchActionsFromUrl", endpoint }),
        frontendUrl,
      });

      return constructRemoteActions({
        json,
        messages,
        url: endpoint.url,
        onBeforeRequest: endpoint.onBeforeRequest,
        graphqlContext,
        logger: logger.child({ component: "remote-actions.constructActions", endpoint }),
        agentStates,
      });
    }),
  );

  return result.flat();
}
