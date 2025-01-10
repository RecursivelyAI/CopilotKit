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
export class CopilotKitError extends GraphQLError {
  code: CopilotKitErrorCode;
  statusCode: number;
  troubleshootingUrl?: string;

  private static getErrorDetails(code: CopilotKitErrorCode): {
    statusCode: number;
    troubleshootingUrl: string;
  } {
    switch (code) {
      case CopilotKitErrorCode.NETWORK_ERROR:
        return {
          statusCode: 503,
          troubleshootingUrl: `${BASE_URL}#my-messages-are-out-of-order`,
        };
      case CopilotKitErrorCode.INVALID_REQUEST:
        return {
          statusCode: 400,
          troubleshootingUrl: `${BASE_URL}#my-messages-are-out-of-order`,
        };
      case CopilotKitErrorCode.SERVER_ERROR:
        return {
          statusCode: 500,
          troubleshootingUrl: `${BASE_URL}#my-messages-are-out-of-order`,
        };
      case CopilotKitErrorCode.NOT_FOUND:
        return {
          statusCode: 500,
          troubleshootingUrl: `${BASE_URL}#my-messages-are-out-of-order`,
        };
      case CopilotKitErrorCode.UNKNOWN:
        return {
          statusCode: 500,
          troubleshootingUrl: `${BASE_URL}#my-messages-are-out-of-order`,
        };
    }
  }

  constructor({
    message = "Unknown error occurred",
    code,
    troubleshootingUri,
  }: {
    message?: string;
    code: CopilotKitErrorCode;
    troubleshootingUri?: string;
  }) {
    const name = ERROR_NAMES.COPILOT_ERROR;
    const { statusCode, troubleshootingUrl } = CopilotKitError.getErrorDetails(code);

    super(message, {
      extensions: {
        name,
        statusCode,
        troubleshootingUrl,
      },
    });
    this.code = code;
    this.name = name;
    this.statusCode = statusCode;
    this.troubleshootingUrl = troubleshootingUri
      ? `${BASE_URL}#${troubleshootingUri}`
      : troubleshootingUrl;
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
    super({ message, code: CopilotKitErrorCode.NOT_FOUND });
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
    const baseMessage = "Failed to find agent";
    const configMessage = "Please verify the agent name exists and is properly configured.";
    const defaultMessage = `${baseMessage}. ${configMessage}`;
    const finalMessage = agentName
      ? `${baseMessage} '${agentName}'. ${configMessage}`
      : defaultMessage;
    super({ message: finalMessage || finalMessage, code: CopilotKitErrorCode.NOT_FOUND });
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
  constructor(error: Error) {
    let errorMessage = "An error occurred while trying to connect to the server.<br/>";
    let code = CopilotKitErrorCode.NETWORK_ERROR;

    if (error instanceof TypeError && error.message.includes("fetch failed")) {
      errorMessage = `
        ${errorMessage} Possible reasons:<br/>
          - The server might be down or unreachable.<br/>
          - There might be a network issue (e.g., DNS failure, connection timeout).<br/>
          - The URL might be incorrect.<br/>
          - The server is not running on the specified port.<br/>
      `;
    } else if ("code" in error && error.code === "ECONNREFUSED") {
      errorMessage += " Connection was refused. Ensure the server is running and accessible.";
    } else if ("code" in error && error.code === "ENOTFOUND") {
      code = CopilotKitErrorCode.NOT_FOUND;
      errorMessage +=
        " The server address could not be found. Check the URL or your network configuration.";
    } else if ("code" in error && error.code === "ETIMEDOUT") {
      errorMessage +=
        " The connection timed out. The server might be overloaded or taking too long to respond.";
    }
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
