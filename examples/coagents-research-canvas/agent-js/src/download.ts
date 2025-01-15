/**
 * Download Node
 *
 * This module contains the implementation of the download_node function.
 */

import { RunnableConfig } from "@langchain/core/runnables";
import { AgentState } from "./state";
import { htmlToText } from "html-to-text";
import { copilotkitEmitState } from "@copilotkit/sdk-js/langgraph";

const RESOURCE_CACHE: Record<string, string> = {};

export function getResource(url: string): string {
  return RESOURCE_CACHE[url] || "";
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3";

async function downloadResource(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to download resource: ${response.statusText}`);
    }

    const htmlContent = await response.text();
    const markdownContent = htmlToText(htmlContent);
    RESOURCE_CACHE[url] = markdownContent;
    return markdownContent;
  } catch (error) {
    clearTimeout(timeoutId);
    RESOURCE_CACHE[url] = "ERROR";
    return `Error downloading resource: ${error}`;
  }
}

export async function download_node(state: AgentState, config: RunnableConfig) {
  const resources = state["resources"] || [];
  const logs = state["logs"] || [];

  const resourcesToDownload = [];

  const logsOffset = logs.length;

  // Find resources that are not downloaded
  for (const resource of resources) {
    if (!getResource(resource.url)) {
      resourcesToDownload.push(resource);
      logs.push({
        message: `Downloading ${resource.url}`,
        done: false,
      });
    }
  }

  // Emit the state to let the UI update
  const { messages, ...restOfState } = state;
  await copilotkitEmitState(config, {
    ...restOfState,
    resources,
    logs,
  });

  // Download the resources
  for (let i = 0; i < resourcesToDownload.length; i++) {
    const resource = resourcesToDownload[i];
    await downloadResource(resource.url);
    logs[logsOffset + i]["done"] = true;
    await copilotkitEmitState(config, state);
  }
  return {
    resources,
    logs,
  };
}
