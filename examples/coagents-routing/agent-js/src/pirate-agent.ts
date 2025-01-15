/**
 * Test Pirate Agent
 */

import { RunnableConfig } from "@langchain/core/runnables";
import { SystemMessage } from "@langchain/core/messages";
import {
  copilotkitExit,
  CopilotKitStateAnnotation,
} from "@copilotkit/sdk-js/langgraph";
import { getModel } from "./model";
import { END, MemorySaver, StateGraph, Annotation } from "@langchain/langgraph";

// Define the PirateAgentState annotation, extending MessagesState
export const PirateAgentStateAnnotation = Annotation.Root({
  model: Annotation<string>(),
  ...CopilotKitStateAnnotation.spec,
});

export type PirateAgentState = typeof PirateAgentStateAnnotation.State;

export async function pirate_node(
  state: PirateAgentState,
  config: RunnableConfig
) {
  /**
   * Speaks like a pirate
   */

  const system_message =
    "You speak like a pirate. Your name is Captain Copilot. " +
    "If the user wants to stop talking, you will say (literally) " +
    "'Arrr, I'll be here if you need me!'";

  const pirate_model = getModel(state);

  const response = await pirate_model.invoke(
    [new SystemMessage({ content: system_message }), ...state.messages],
    config
  );

  if (response.content === "Arrr, I'll be here if you need me!") {
    await copilotkitExit(config);
  }

  return {
    messages: [...state.messages, response],
  };
}

const workflow = new StateGraph(PirateAgentStateAnnotation)
  .addNode("pirate_node", pirate_node)
  .setEntryPoint("pirate_node")
  .addEdge("pirate_node", END);

const memory = new MemorySaver();

export const pirateGraph = workflow.compile({
  checkpointer: memory,
});
