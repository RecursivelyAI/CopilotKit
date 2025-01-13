import { GraphQLError } from "graphql";

export const ERROR_NAMES = {
  COPILOT_ERROR: "CopilotError",
  COPILOT_API_DISCOVERY_ERROR: "CopilotApiDiscoveryError",
  COPILOT_KIT_AGENT_DISCOVERY_ERROR: "CopilotKitAgentDiscoveryError",
  COPILOT_KIT_LOW_LEVEL_ERROR: "CopilotKitLowLevelError",
  RESOLVED_COPILOT_KIT_ERROR: "ResolvedCopilotKitError",
} as const;

export enum CopilotKitErrorCode {
  NETWORK_ERROR = "NETWORK_ERROR",
  INVALID_REQUEST = "INVALID_REQUEST",
  SERVER_ERROR = "SERVER_ERROR",
  NOT_FOUND = "NOT_FOUND",
  UNKNOWN = "UNKNOWN",
}

const BASE_URL = "https://docs.copilotkit.ai/coagents/troubleshooting/common-issues";

const getSeeMoreMarkdown = (link: string) => `See more: [${link}](${link})`;

export const ERROR_CONFIG = {
  [CopilotKitErrorCode.NETWORK_ERROR]: {
    statusCode: 503,
    troubleshootingUrl: `${BASE_URL}#my-messages-are-out-of-order`,
  },
  [CopilotKitErrorCode.INVALID_REQUEST]: {
    statusCode: 400,
    troubleshootingUrl: `${BASE_URL}#my-messages-are-out-of-order`,
  },
  [CopilotKitErrorCode.SERVER_ERROR]: {
    statusCode: 500,
    troubleshootingUrl: `${BASE_URL}#my-messages-are-out-of-order`,
  },
  [CopilotKitErrorCode.NOT_FOUND]: {
    statusCode: 500,
    troubleshootingUrl: `${BASE_URL}#my-messages-are-out-of-order`,
  },
  [CopilotKitErrorCode.UNKNOWN]: {
    statusCode: 500,
    troubleshootingUrl: `${BASE_URL}#my-messages-are-out-of-order`,
  },
};

export class CopilotKitError extends GraphQLError {
  code: CopilotKitErrorCode;
  statusCode: number;

  constructor({
    message = "Unknown error occurred",
    code,
  }: {
    message?: string;
    code: CopilotKitErrorCode;
  }) {
    const name = ERROR_NAMES.COPILOT_ERROR;
    const { statusCode } = ERROR_CONFIG[code];

    super(message, {
      extensions: {
        name,
        statusCode,
      },
    });
    this.code = code;
    this.name = name;
    this.statusCode = statusCode;
  }
}

/**
 * Error thrown when the CopilotKit API endpoint cannot be discovered or accessed.
 * This typically occurs when:
 * - The API endpoint URL is invalid or misconfigured
 * - The API service is not running at the expected location
 * - There are network/firewall issues preventing access
 *
 * @extends CopilotKitError
 */
export class CopilotKitApiDiscoveryError extends CopilotKitError {
  constructor({ message = "Failed to find CopilotKit API endpoint" }: { message?: string } = {}) {
    const code = CopilotKitErrorCode.NOT_FOUND;
    const errorMessage = `${message}.\n\n${getSeeMoreMarkdown(ERROR_CONFIG[code].troubleshootingUrl)}`;
    super({ message: errorMessage, code });
    this.name = ERROR_NAMES.COPILOT_API_DISCOVERY_ERROR;
  }
}

/**
 * Error thrown when a LangGraph agent cannot be found or accessed.
 * This typically occurs when:
 * - The specified agent name does not exist in the deployment
 * - The agent configuration is invalid or missing
 * - The agent service is not properly deployed or initialized
 *
 * @extends CopilotKitError
 */
export class CopilotKitAgentDiscoveryError extends CopilotKitError {
  constructor({ agentName }: { agentName?: string } = {}) {
    const code = CopilotKitErrorCode.NOT_FOUND;
    const baseMessage = "Failed to find agent";
    const configMessage = "Please verify the agent name exists and is properly configured.";
    const finalMessage = agentName
      ? `${baseMessage} '${agentName}'. ${configMessage}\n\n${getSeeMoreMarkdown(ERROR_CONFIG[code].troubleshootingUrl)}`
      : `${baseMessage}. ${configMessage}\n\n${getSeeMoreMarkdown(ERROR_CONFIG[code].troubleshootingUrl)}`;
    super({ message: finalMessage || finalMessage, code });
    this.name = ERROR_NAMES.COPILOT_KIT_AGENT_DISCOVERY_ERROR;
  }
}

/**
 * Handles low-level networking errors that occur before a request reaches the server.
 * These errors arise from issues in the underlying communication infrastructure rather than
 * application-level logic or server responses. Typically used to handle "fetch failed" errors
 * where no HTTP status code is available.
 *
 * Common scenarios include:
 * - Connection failures (ECONNREFUSED) when server is down/unreachable
 * - DNS resolution failures (ENOTFOUND) when domain can't be resolved
 * - Timeouts (ETIMEDOUT) when request takes too long
 * - Protocol/transport layer errors like SSL/TLS issues
 */
export class CopilotKitLowLevelError extends CopilotKitError {
  constructor({ error, url, message }: { error: Error; url: string; message?: string }) {
    let code = CopilotKitErrorCode.NETWORK_ERROR;

    const getMessageByCode = (errorCode?: string) => {
      const troubleshootingLink = ERROR_CONFIG[code].troubleshootingUrl;
      switch (errorCode) {
        case "ECONNREFUSED":
          return `Connection to ${url} was refused. Ensure the server is running and accessible.\n\n${getSeeMoreMarkdown(troubleshootingLink)}`;
        case "ENOTFOUND":
          return `The server on ${url} could not be found. Check the URL or your network configuration.\n\n${getSeeMoreMarkdown(ERROR_CONFIG[CopilotKitErrorCode.NOT_FOUND].troubleshootingUrl)}`;
        case "ETIMEDOUT":
          return `The connection to ${url} timed out. The server might be overloaded or taking too long to respond.\n\n${getSeeMoreMarkdown(troubleshootingLink)}`;
        default:
          return `Failed to fetch from url ${url}.

Possible reasons:
- -The server might be down or unreachable
- -There might be a network issue (e.g., DNS failure, connection timeout) 
- -The URL might be incorrect
- -The server is not running on the specified port

${getSeeMoreMarkdown(troubleshootingLink)}`;
      }
    };
    // @ts-expect-error -- code may exist
    const errorMessage = message ?? getMessageByCode(error.code as string);

    super({ message: errorMessage, code });

    this.name = ERROR_NAMES.COPILOT_KIT_LOW_LEVEL_ERROR;
  }
}

/**
 * Generic catch-all error handler for HTTP responses from the CopilotKit API where a status code is available.
 * Used when we receive an HTTP error status and wish to handle broad range of them
 *
 * This differs from CopilotKitLowLevelError in that:
 * - ResolvedCopilotKitError: Server was reached and returned an HTTP status
 * - CopilotKitLowLevelError: Error occurred before reaching server (e.g. network failure)
 *
 * @param status - The HTTP status code received from the API response
 * @param message - Optional error message to include
 * @param code - Optional specific CopilotKitErrorCode to override default behavior
 *
 * Default behavior:
 * - 400 Bad Request: Maps to CopilotKitApiDiscoveryError
 * - All other status codes: Maps to UNKNOWN error code if no specific code provided
 */
export class ResolvedCopilotKitError extends CopilotKitError {
  constructor({
    status,
    message,
    code,
  }: {
    status: number;
    message?: string;
    code?: CopilotKitErrorCode;
  }) {
    let resolvedCode = code;
    if (!resolvedCode) {
      switch (status) {
        case 400:
          throw new CopilotKitApiDiscoveryError({ message });
        case 404:
          throw new CopilotKitApiDiscoveryError({ message });
        default:
          resolvedCode = CopilotKitErrorCode.UNKNOWN;
          super({ message, code: resolvedCode });
      }
    } else {
      super({ message, code: resolvedCode });
    }
    this.name = ERROR_NAMES.RESOLVED_COPILOT_KIT_ERROR;
  }
}
