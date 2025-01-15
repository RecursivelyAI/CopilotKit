import {
  CopilotContextParams,
  CopilotMessagesContextParams,
  defaultCopilotContextCategories,
} from "@copilotkit/react-core";
import { CopilotKitVersion } from "./types";
import { ActionExecutionMessage, ResultMessage, TextMessage } from "@copilotkit/runtime-client-gql";
import { AgentStateMessage } from "@copilotkit/runtime-client-gql";

export function shouldShowDevConsole(showDevConsole: boolean | "auto"): boolean {
  if (typeof showDevConsole === "boolean") {
    return showDevConsole;
  }
  return (
    getHostname() === "localhost" ||
    getHostname() === "127.0.0.1" ||
    getHostname() === "0.0.0.0" ||
    getHostname() === "::1"
  );
}

function getHostname(): string {
  if (typeof window !== "undefined" && window.location) {
    return window.location.hostname;
  }
  return "";
}

export async function getPublishedCopilotKitVersion(
  current: string,
  forceCheck: boolean = false,
): Promise<CopilotKitVersion> {
  const LOCAL_STORAGE_KEY = "__copilotkit_version_check__";
  const serializedVersion = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (serializedVersion && !forceCheck) {
    try {
      const parsedVersion: CopilotKitVersion = JSON.parse(serializedVersion);
      const oneHour = 60 * 60 * 1000;
      const now = new Date().getTime();

      if (
        parsedVersion.current === current &&
        now - new Date(parsedVersion.lastChecked).getTime() < oneHour
      ) {
        return parsedVersion;
      }
    } catch (error) {
      console.error("Failed to parse CopilotKitVersion from localStorage", error);
    }
  }

  try {
    const response = await fetch("https://api.cloud.copilotkit.ai/check-for-updates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        packages: [
          {
            packageName: "@copilotkit/shared",
            packageVersion: current,
          },
        ],
      }),
    });

    const data = await response.json();

    const version: CopilotKitVersion = {
      current,
      lastChecked: new Date().getTime(),
      latest: data.packages[0].latestVersion,
      severity: data.packages[0].severity,
      advisory: data.packages[0].advisory || null,
    };

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(version));
    return version;
  } catch (error) {
    console.error("Failed to check for updates", error);
    throw error;
  }
}

export function logReadables(context: CopilotContextParams) {
  console.log("%cCurrent Readables:", "font-size: 16px; font-weight: bold;");

  const readables = context.getContextString([], defaultCopilotContextCategories).trim();
  if (readables.length === 0) {
    console.log("No readables found");
    return;
  }
  console.log(readables);
}

export function logActions(context: CopilotContextParams) {
  console.log("%cCurrent Actions:", "font-size: 16px; font-weight: bold;");

  if (Object.values(context.actions).length === 0) {
    console.log("No actions found");
    return;
  }
  for (const action of Object.values(context.actions)) {
    console.group(action.name);
    console.log("name", action.name);
    console.log("description", action.description);
    console.log("parameters", action.parameters);

    console.groupEnd();
  }
}

export function logMessages(context: CopilotMessagesContextParams) {
  console.log("%cCurrent Messages:", "font-size: 16px; font-weight: bold;");

  if (context.messages.length === 0) {
    console.log("No messages found");
    return;
  }

  const tableData = context.messages.map((message) => {
    if (message.isTextMessage()) {
      return {
        id: message.id,
        type: "TextMessage",
        role: message.role,
        name: undefined,
        scope: undefined,
        content: message.content,
      };
    } else if (message.isActionExecutionMessage()) {
      return {
        id: message.id,
        type: "ActionExecutionMessage",
        role: undefined,
        name: message.name,
        scope: message.parentMessageId,
        content: message.arguments,
      };
    } else if (message.isResultMessage()) {
      return {
        id: message.id,
        type: "ResultMessage",
        role: undefined,
        name: message.actionName,
        scope: message.actionExecutionId,
        content: message.result,
      };
    } else if (message.isAgentStateMessage()) {
      return {
        id: message.id,
        type: `AgentStateMessage (running: ${message.running})`,
        role: message.role,
        name: undefined,
        scope: message.threadId,
        content: message.state,
      };
    }
  });
  console.table(tableData);
}
