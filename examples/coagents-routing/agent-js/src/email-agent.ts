/**
 * Test Joker Agent
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { RunnableConfig } from "@langchain/core/runnables";
import {
  copilotkitCustomizeConfig,
  CopilotKitStateAnnotation,
  copilotkitExit,
} from "@copilotkit/sdk-js/langgraph";
import { SystemMessage, ToolMessage } from "@langchain/core/messages";
import { getModel } from "./model";
import { END, MemorySaver, StateGraph } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";

// Define the EmailAgentState annotation, extending MessagesState
export const EmailAgentStateAnnotation = Annotation.Root({
  model: Annotation<string>(),
  email: Annotation<string>(),
  ...CopilotKitStateAnnotation.spec,
});

export type EmailAgentState = typeof EmailAgentStateAnnotation.State;

const write_email = tool(() => {}, {
  name: "write_email",
  description: "Write an email.",
  schema: z.object({
    the_email: z.string().describe("The email"),
  }),
});

export async function email_node(
  state: EmailAgentState,
  config: RunnableConfig
) {
  /**
   * Make a joke.
   */

  config = copilotkitCustomizeConfig(config, {
    emitMessages: true,
    emitIntermediateState: [
      {
        stateKey: "email",
        tool: "write_email",
        toolArgument: "the_email",
      },
    ],
  });

  const system_message = "You write emails.";

  const email_model = getModel(state).bindTools!([write_email], {
    tool_choice: "write_email",
  });

  const response = await email_model.invoke(
    [new SystemMessage({ content: system_message }), ...state.messages],
    config
  );

  const tool_calls = response.tool_calls;

  const email = tool_calls?.[0]?.args.the_email;

  await copilotkitExit(config);

  return {
    messages: [
      response,
      new ToolMessage({
        name: tool_calls?.[0]?.name,
        content: email,
        tool_call_id: tool_calls?.[0]?.id!,
      }),
    ],
    email: email,
  };
}

const workflow = new StateGraph(EmailAgentStateAnnotation)
  .addNode("email_node", email_node)
  .setEntryPoint("email_node")
  .addEdge("email_node", END);

const memory = new MemorySaver();

export const emailGraph = workflow.compile({
  checkpointer: memory,
});
