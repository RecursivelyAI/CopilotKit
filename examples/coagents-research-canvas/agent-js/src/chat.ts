/**
 * Chat Node
 */

import { RunnableConfig } from "@langchain/core/runnables";
import { AgentState, Resource } from "./state";
import { getModel } from "./model";
import { getResource } from "./download";
import {
  SystemMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { copilotkitCustomizeConfig } from "@copilotkit/sdk-js/langgraph";

const Search = tool(() => {}, {
  name: "Search",
  description:
    "A list of one or more search queries to find good resources to support the research.",
  schema: z.object({ queries: z.array(z.string()) }),
});

const WriteReport = tool(() => {}, {
  name: "WriteReport",
  description: "Write the research report.",
  schema: z.object({ report: z.string() }),
});

const WriteResearchQuestion = tool(() => {}, {
  name: "WriteResearchQuestion",
  description: "Write the research question.",
  schema: z.object({ research_question: z.string() }),
});

const DeleteResources = tool(() => {}, {
  name: "DeleteResources",
  description: "Delete the URLs from the resources.",
  schema: z.object({ urls: z.array(z.string()) }),
});

export async function chat_node(state: AgentState, config: RunnableConfig) {
  const customConfig = copilotkitCustomizeConfig(config, {
    emitIntermediateState: [
      {
        stateKey: "report",
        tool: "WriteReport",
        toolArgument: "report",
      },
      {
        stateKey: "research_question",
        tool: "WriteResearchQuestion",
        toolArgument: "research_question",
      },
    ],
    emitToolCalls: "DeleteResources",
  });

  state["resources"] = state.resources || [];
  const researchQuestion = state.research_question || "";
  const report = state.report || "";

  const resources: Resource[] = [];

  for (const resource of state["resources"]) {
    const content = getResource(resource.url);
    if (content === "ERROR") {
      continue;
    }
    resource.content = content;
    resources.push(resource);
  }

  const model = getModel(state);
  const invokeArgs: Record<string, unknown> = {};
  if (model.constructor.name === "ChatOpenAI") {
    invokeArgs["parallel_tool_calls"] = false;
  }

  const response = await model.bindTools!(
    [Search, WriteReport, WriteResearchQuestion, DeleteResources],
    invokeArgs
  ).invoke(
    [
      new SystemMessage(
        `You are a research assistant. You help the user with writing a research report.
        Do not recite the resources, instead use them to answer the user's question.
        You should use the search tool to get resources before answering the user's question.
        If you finished writing the report, ask the user proactively for next steps, changes etc, make it engaging.
        To write the report, you should use the WriteReport tool. Never EVER respond with the report, only use the tool.
        If a research question is provided, YOU MUST NOT ASK FOR IT AGAIN.

        This is the research question:
        ${researchQuestion}

        This is the research report:
        ${report}

        Here are the resources that you have available:
        ${JSON.stringify(resources)}
        `
      ),
      ...state.messages,
    ],
    customConfig
  );

  const aiMessage = response as AIMessage;

  if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
    if (aiMessage.tool_calls[0].name === "WriteReport") {
      const report = aiMessage.tool_calls[0].args.report;
      return {
        report,
        messages: [
          aiMessage,
          new ToolMessage({
            tool_call_id: aiMessage.tool_calls![0]["id"]!,
            content: "Report written.",
            name: "WriteReport",
          }),
        ],
      };
    } else if (aiMessage.tool_calls[0].name === "WriteResearchQuestion") {
      const researchQuestion = aiMessage.tool_calls[0].args.research_question;
      return {
        research_question: researchQuestion,
        messages: [
          aiMessage,
          new ToolMessage({
            tool_call_id: aiMessage.tool_calls![0]["id"]!,
            content: "Research question written.",
            name: "WriteResearchQuestion",
          }),
        ],
      };
    }
  }

  return {
    messages: response,
  };
}
