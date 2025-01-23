import { createHash } from "node:crypto";
import {
  CopilotKitEndpoint,
  LangGraphAgentHandlerParams,
  RemoteActionInfoResponse,
  LangGraphPlatformEndpoint,
} from "./remote-actions";
import { GraphQLContext } from "../integrations";
import { Logger } from "pino";
import { Message } from "../../graphql/types/converted";
import { AgentStateInput } from "../../graphql/inputs/agent-state.input";
import { Observable, ReplaySubject } from "rxjs";
import { RuntimeEvent } from "../../service-adapters/events";
import telemetry from "../telemetry-client";
import { RemoteLangGraphEventSource } from "../../agents/langgraph/event-source";
import { Action } from "@copilotkit/shared";
import { LangGraphEvent } from "../../agents/langgraph/events";
import { execute } from "./remote-lg-action";
import { CopilotKitError, CopilotKitLowLevelError } from "@copilotkit/shared";

export function constructLGCRemoteAction({
  endpoint,
  graphqlContext,
  logger,
  messages,
  agentStates,
}: {
  endpoint: LangGraphPlatformEndpoint;
  graphqlContext: GraphQLContext;
  logger: Logger;
  messages: Message[];
  agentStates?: AgentStateInput[];
}) {
  const agents = endpoint.agents.map((agent) => ({
    name: agent.name,
    description: agent.description,
    parameters: [],
    handler: async (_args: any) => {},
    langGraphAgentHandler: async ({
      name,
      actionInputsWithoutAgents,
      threadId,
      nodeName,
      additionalMessages = [],
      metaEvents,
    }: LangGraphAgentHandlerParams): Promise<Observable<RuntimeEvent>> => {
      logger.debug({ actionName: agent.name }, "Executing LangGraph Platform agent");

      telemetry.capture("oss.runtime.remote_action_executed", {
        agentExecution: true,
        type: "langgraph-platform",
        agentsAmount: endpoint.agents.length,
        hashedLgcKey: createHash("sha256").update(endpoint.langsmithApiKey).digest("hex"),
      });

      let state = {};
      if (agentStates) {
        const jsonState = agentStates.find((state) => state.agentName === name)?.state;
        if (jsonState) {
          state = JSON.parse(jsonState);
        }
      }

      try {
        const response = await execute({
          logger: logger.child({ component: "remote-actions.remote-lg-action.streamEvents" }),
          deploymentUrl: endpoint.deploymentUrl,
          langsmithApiKey: endpoint.langsmithApiKey,
          agent,
          threadId,
          nodeName,
          messages: [...messages, ...additionalMessages],
          state,
          properties: graphqlContext.properties,
          actions: actionInputsWithoutAgents.map((action) => ({
            name: action.name,
            description: action.description,
            parameters: JSON.parse(action.jsonSchema) as string,
          })),
          metaEvents,
        });

        const eventSource = new RemoteLangGraphEventSource();
        streamResponse(response, eventSource.eventStream$);
        return eventSource.processLangGraphEvents();
      } catch (error) {
        logger.error(
          { url: endpoint.deploymentUrl, status: 500, body: error.message },
          "Failed to execute LangGraph Platform agent",
        );
        throw new Error("Failed to execute LangGraph Platform agent");
      }
    },
  }));

  return [...agents];
}

export function constructRemoteActions({
  json,
  url,
  onBeforeRequest,
  graphqlContext,
  logger,
  messages,
  agentStates,
}: {
  json: RemoteActionInfoResponse;
  url: string;
  onBeforeRequest?: CopilotKitEndpoint["onBeforeRequest"];
  graphqlContext: GraphQLContext;
  logger: Logger;
  messages: Message[];
  agentStates?: AgentStateInput[];
}): Action<any>[] {
  const totalAgents = Array.isArray(json["agents"]) ? json["agents"].length : 0;

  const actions = json["actions"].map((action) => ({
    name: action.name,
    description: action.description,
    parameters: action.parameters,
    handler: async (args: any) => {
      logger.debug({ actionName: action.name, args }, "Executing remote action");

      const headers = createHeaders(onBeforeRequest, graphqlContext);
      telemetry.capture("oss.runtime.remote_action_executed", {
        agentExecution: false,
        type: "self-hosted",
        agentsAmount: totalAgents,
      });

      const fetchUrl = `${url}/actions/execute`;
      try {
        const response = await fetch(fetchUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: action.name,
            arguments: args,
            properties: graphqlContext.properties,
          }),
        });

        if (!response.ok) {
          logger.error(
            { url, status: response.status, body: await response.text() },
            "Failed to execute remote action",
          );
          return "Failed to execute remote action";
        }

        const requestResult = await response.json();

        const result = requestResult["result"];
        logger.debug({ actionName: action.name, result }, "Executed remote action");
        return result;
      } catch (error) {
        if (error instanceof CopilotKitError) {
          throw error;
        }
        throw new CopilotKitLowLevelError({ error, url: fetchUrl });
      }
    },
  }));

  const agents = totalAgents
    ? json["agents"].map((agent) => ({
        name: agent.name,
        description: agent.description,
        parameters: [],
        handler: async (_args: any) => {},

        langGraphAgentHandler: async ({
          name,
          actionInputsWithoutAgents,
          threadId,
          nodeName,
          additionalMessages = [],
          metaEvents,
        }: LangGraphAgentHandlerParams): Promise<Observable<RuntimeEvent>> => {
          logger.debug({ actionName: agent.name }, "Executing remote agent");

          const headers = createHeaders(onBeforeRequest, graphqlContext);
          telemetry.capture("oss.runtime.remote_action_executed", {
            agentExecution: true,
            type: "self-hosted",
            agentsAmount: json["agents"].length,
          });

          let state = {};
          if (agentStates) {
            const jsonState = agentStates.find((state) => state.agentName === name)?.state;
            if (jsonState) {
              state = JSON.parse(jsonState);
            }
          }

          const fetchUrl = `${url}/agents/execute`;
          try {
            const response = await fetch(fetchUrl, {
              method: "POST",
              headers,
              body: JSON.stringify({
                name,
                threadId,
                nodeName,
                messages: [...messages, ...additionalMessages],
                state,
                properties: graphqlContext.properties,
                actions: actionInputsWithoutAgents.map((action) => ({
                  name: action.name,
                  description: action.description,
                  parameters: JSON.parse(action.jsonSchema),
                })),
                metaEvents,
              }),
            });

            if (!response.ok) {
              logger.error(
                { url, status: response.status, body: await response.text() },
                "Failed to execute remote agent",
              );
              throw new Error("Failed to execute remote agent");
            }

            const eventSource = new RemoteLangGraphEventSource();
            streamResponse(response.body!, eventSource.eventStream$);
            return eventSource.processLangGraphEvents();
          } catch (error) {
            if (error instanceof CopilotKitError) {
              throw error;
            }
            throw new CopilotKitLowLevelError({ error, url: fetchUrl });
          }
        },
      }))
    : [];

  return [...actions, ...agents];
}

async function streamResponse(
  response: ReadableStream<Uint8Array>,
  eventStream$: ReplaySubject<LangGraphEvent>,
) {
  const reader = response.getReader();
  const decoder = new TextDecoder();
  let buffer = [];

  function flushBuffer() {
    const currentBuffer = buffer.join("");
    if (currentBuffer.trim().length === 0) {
      return;
    }
    const parts = currentBuffer.split("\n");
    if (parts.length === 0) {
      return;
    }

    const lastPartIsComplete = currentBuffer.endsWith("\n");

    // truncate buffer
    buffer = [];

    if (!lastPartIsComplete) {
      // put back the last part
      buffer.push(parts.pop());
    }

    parts
      .map((part) => part.trim())
      .filter((part) => part != "")
      .forEach((part) => {
        eventStream$.next(JSON.parse(part));
      });
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (!done) {
        buffer.push(decoder.decode(value, { stream: true }));
      }

      flushBuffer();

      if (done) {
        break;
      }
    }
  } catch (error) {
    console.error("Error in stream", error);
    eventStream$.error(error);
    return;
  }
  eventStream$.complete();
}

export function createHeaders(
  onBeforeRequest: CopilotKitEndpoint["onBeforeRequest"],
  graphqlContext: GraphQLContext,
) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (onBeforeRequest) {
    const { headers: additionalHeaders } = onBeforeRequest({ ctx: graphqlContext });
    if (additionalHeaders) {
      Object.assign(headers, additionalHeaders);
    }
  }

  return headers;
}
