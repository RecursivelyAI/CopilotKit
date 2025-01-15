import {
  Client,
  cacheExchange,
  fetchExchange,
  mapExchange,
  CombinedError,
  Operation,
} from "@urql/core";
import * as packageJson from "../../package.json";

import {
  AvailableAgentsQuery,
  GenerateCopilotResponseMutation,
  GenerateCopilotResponseMutationVariables,
} from "../graphql/@generated/graphql";
import { generateCopilotResponseMutation } from "../graphql/definitions/mutations";
import { getAvailableAgentsQuery } from "../graphql/definitions/queries";
import { OperationResultSource, OperationResult } from "urql";
import { CopilotKitLowLevelError, ResolvedCopilotKitError } from "@copilotkit/shared";

const createFetchFn =
  (signal?: AbortSignal) =>
  async (...args: Parameters<typeof fetch>) => {
    try {
      const result = await fetch(args[0], { ...(args[1] ?? {}), signal });
      if (result.status !== 200) {
        throw new ResolvedCopilotKitError({ status: result.status });
      }
      return result;
    } catch (error) {
      throw new CopilotKitLowLevelError({ error: error as Error, url: args[0] as string });
    }
  };

export interface CopilotRuntimeClientOptions {
  url: string;
  publicApiKey?: string;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  handleGQLErrors?: (error: Error) => void;
}

export class CopilotRuntimeClient {
  client: Client;
  public handleGQLErrors?: (error: Error) => void;

  constructor(options: CopilotRuntimeClientOptions) {
    const headers: Record<string, string> = {};

    this.handleGQLErrors = options.handleGQLErrors;

    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    if (options.publicApiKey) {
      headers["x-copilotcloud-public-api-key"] = options.publicApiKey;
    }

    this.client = new Client({
      url: options.url,
      exchanges: [cacheExchange, fetchExchange],
      fetchOptions: {
        headers: {
          ...headers,
          "X-CopilotKit-Runtime-Client-GQL-Version": packageJson.version,
        },
        ...(options.credentials ? { credentials: options.credentials } : {}),
      },
    });
  }

  generateCopilotResponse({
    data,
    properties,
    signal,
  }: {
    data: GenerateCopilotResponseMutationVariables["data"];
    properties?: GenerateCopilotResponseMutationVariables["properties"];
    signal?: AbortSignal;
  }) {
    const fetchFn = createFetchFn(signal);
    const result = this.client.mutation<
      GenerateCopilotResponseMutation,
      GenerateCopilotResponseMutationVariables
    >(generateCopilotResponseMutation, { data, properties }, { fetch: fetchFn });

    return result;
  }

  public asStream<S, T>(source: OperationResultSource<OperationResult<S, { data: T }>>) {
    const handleGQLErrors = this.handleGQLErrors;
    return new ReadableStream<S>({
      start(controller) {
        source.subscribe(({ data, hasNext, error }) => {
          if (error) {
            if (
              error.message.includes("BodyStreamBuffer was aborted") ||
              error.message.includes("signal is aborted without reason")
            ) {
              // Suppress this specific error
              console.warn("Abort error suppressed");
              return;
            }
            controller.error(error);
            if (handleGQLErrors) {
              handleGQLErrors(error);
            }
          } else {
            controller.enqueue(data);
            if (!hasNext) {
              controller.close();
            }
          }
        });
      },
    });
  }

  availableAgents() {
    const fetchFn = createFetchFn();
    return this.client.query<AvailableAgentsQuery>(getAvailableAgentsQuery, {}, { fetch: fetchFn });
  }
}
