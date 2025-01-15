/**
 * Test Joker Agent
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { RunnableConfig } from "@langchain/core/runnables";
import {
  copilotkitCustomizeConfig,
  copilotkitExit,
  CopilotKitStateAnnotation,
} from "@copilotkit/sdk-js/langgraph";
import { SystemMessage, ToolMessage } from "@langchain/core/messages";
import { getModel } from "./model";
import { END, MemorySaver, StateGraph, Annotation } from "@langchain/langgraph";

// Define the JokeAgentState annotation, extending MessagesState
export const JokeAgentStateAnnotation = Annotation.Root({
  model: Annotation<string>(),
  joke: Annotation<string>(),
  ...CopilotKitStateAnnotation.spec,
});

export type JokeAgentState = typeof JokeAgentStateAnnotation.State;

const make_joke = tool(() => {}, {
  name: "make_joke",
  description: "Make a funny joke.",
  schema: z.object({
    the_joke: z.string().describe("The joke"),
  }),
});

export async function joke_node(state: JokeAgentState, config: RunnableConfig) {
  /**
   * Make a joke.
   */

  config = copilotkitCustomizeConfig(config, {
    emitMessages: true,
    emitIntermediateState: [
      {
        stateKey: "joke",
        tool: "make_joke",
        toolArgument: "the_joke",
      },
    ],
  });

  const system_message = "You make funny jokes.";

  const joke_model = getModel(state).bindTools!([make_joke], {
    tool_choice: "make_joke",
  });

  const response = await joke_model.invoke(
    [new SystemMessage({ content: system_message }), ...state.messages],
    config
  );

  const tool_calls = response.tool_calls;

  const joke = tool_calls?.[0]?.args.the_joke;

  await copilotkitExit(config);

  return {
    messages: [
      response,
      new ToolMessage({
        name: tool_calls?.[0]?.name,
        content: joke,
        tool_call_id: tool_calls?.[0]?.id!,
      }),
    ],
    joke: joke,
  };
}

const workflow = new StateGraph(JokeAgentStateAnnotation)
  .addNode("joke_node", joke_node)
  .setEntryPoint("joke_node")
  .addEdge("joke_node", END);

const memory = new MemorySaver();

export const jokeGraph = workflow.compile({
  checkpointer: memory,
});
