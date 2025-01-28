export enum LangGraphEventTypes {
  OnChainStart = "on_chain_start",
  OnChainStream = "on_chain_stream",
  OnChainEnd = "on_chain_end",
  OnChatModelStart = "on_chat_model_start",
  OnChatModelStream = "on_chat_model_stream",
  OnChatModelEnd = "on_chat_model_end",
  OnToolStart = "on_tool_start",
  OnToolEnd = "on_tool_end",
  OnCopilotKitStateSync = "on_copilotkit_state_sync",
  OnCopilotKitEmitMessage = "on_copilotkit_emit_message",
  OnCopilotKitEmitToolCall = "on_copilotkit_emit_tool_call",
  OnCustomEvent = "on_custom_event",
  OnInterrupt = "on_interrupt",
}

export enum MetaEventNames {
  LangGraphInterruptEvent = "LangGraphInterruptEvent",
}

export enum CustomEventNames {
  CopilotKitManuallyEmitMessage = "copilotkit_manually_emit_message",
  CopilotKitManuallyEmitToolCall = "copilotkit_manually_emit_tool_call",
  CopilotKitManuallyEmitIntermediateState = "copilotkit_manually_emit_intermediate_state",
  CopilotKitExit = "copilotkit_exit",
}

type LangGraphOnCopilotKitStateSyncEvent = {
  event: LangGraphEventTypes.OnCopilotKitStateSync;
  thread_id: string;
  agent_name: string;
  node_name: string;
  run_id: string;
  active: boolean;
  role: string;
  state: any;
  running: boolean;
};

type LangGraphOnChainStartEvent = {
  event: LangGraphEventTypes.OnChainStart;
  run_id: string;
  name: string;
  tags: string[];
  metadata: { thread_id: string };
  data: {
    input: any;
  };
  parent_ids: string[];
};

type LangGraphOnChainEndEvent = {
  event: LangGraphEventTypes.OnChainEnd;
  name: string;
  run_id: string;
  tags: string[];
  metadata: {
    thread_id: string;
    langgraph_step: number;
    langgraph_node: string;
    langgraph_triggers: string[];
    langgraph_task_idx: number;
    thread_ts: string;
  };
  data: {
    input: any;
    output: any;
  };
  parent_ids: string[];
};

type LangGraphOnChatModelStartEvent = {
  event: LangGraphEventTypes.OnChatModelStart;
  name: string;
  run_id: string;
  tags: string[];
  metadata: {
    thread_id: string;
    langgraph_step: number;
    langgraph_node: string;
    langgraph_triggers: string[];
    langgraph_task_idx: number;
    thread_ts: string;
    ls_provider: string;
    ls_model_name: string;
    ls_model_type: string;
    ls_temperature: number;
  };
  data: {
    input: {
      messages: {
        lc: number;
        type: string;
        id: string[];
        kwargs: {
          content: string;
          type: string;
          id: string;
        };
      }[][];
    };
  };
  parent_ids: string[];
};

type LangGraphOnChatModelStreamEvent = {
  event: LangGraphEventTypes.OnChatModelStream;
  name: string;
  run_id: string;
  tags: string[];
  metadata: {
    thread_id: string;
    langgraph_step: number;
    langgraph_node: string;
    langgraph_triggers: string[];
    langgraph_task_idx: number;
    thread_ts: string;
    ls_provider: string;
    ls_model_name: string;
    ls_model_type: string;
    ls_temperature: number;
  };
  data: {
    chunk: {
      lc: number;
      type: string;
      id: string;
      kwargs: {
        content: string | { text: string; type: string; index: number }[];
        additional_kwargs: {
          tool_calls: {
            index: number;
            id: string;
            function: { arguments: string; name: string };
            type: string;
          }[];
        };
        type: string;
        id: string;
        tool_calls: { name: string; args: {}; id: string; type: string }[];
        tool_call_chunks: {
          name: string;
          args: string;
          id: string;
          index: number;
          type: string;
        }[];
        invalid_tool_calls: any[];
      };
    };
  };
  parent_ids: string[];
};

type LangGraphOnChatModelEndEvent = {
  event: LangGraphEventTypes.OnChatModelEnd;
  name: string;
  run_id: string;
  tags: string[];
  metadata: {
    thread_id: string;
    langgraph_step: number;
    langgraph_node: string;
    langgraph_triggers: string[];
    langgraph_task_idx: number;
    thread_ts: string;
    ls_provider: string;
    ls_model_name: string;
    ls_model_type: string;
    ls_temperature: number;
  };
  data: {
    input: any;
    output: {
      generations: {
        text: string;
        generation_info: {
          finish_reason: string;
          model_name: string;
          system_fingerprint: string;
        };
        type: string;
        message: {
          lc: number;
          type: string;
          id: string[];
          kwargs: {
            content: string;
            additional_kwargs: {
              tool_calls: {
                index: number;
                id: string;
                function: { arguments: string; name: string };
                type: string;
              }[];
            };
            response_metadata: {
              finish_reason: string;
              model_name: string;
              system_fingerprint: string;
            };
            type: string;
            id: string;
            tool_calls: { name: string; args: { query: string }; id: string; type: string }[];
            invalid_tool_calls: any[];
          };
        };
      }[][];
      llm_output: any;
      run: any;
    };
  };
  parent_ids: string[];
};

type LangGraphOnChainStreamEvent = {
  event: LangGraphEventTypes.OnChainStream;
  name: string;
  run_id: string;
  tags: string[];
  metadata: {
    thread_id: string;
    langgraph_step?: number;
    langgraph_node?: string;
    langgraph_triggers?: string[];
    langgraph_task_idx?: number;
    thread_ts?: string;
  };
  data: {
    chunk: {
      messages: {
        lc: number;
        type: string;
        id: string[];
        kwargs: {
          content: string;
          additional_kwargs?: {
            tool_calls?: {
              index: number;
              id: string;
              function: { arguments: string; name: string };
              type: string;
            }[];
          };
          response_metadata?: {
            finish_reason: string;
            model_name: string;
            system_fingerprint: string;
          };
          type: string;
          id: string;
          tool_calls?: { name: string; args: { query: string }; id: string; type: string }[];
          invalid_tool_calls?: any[];
        };
      }[];
    };
  };
  parent_ids: string[];
};

type LangGraphOnToolStartEvent = {
  event: LangGraphEventTypes.OnToolStart;
  name: string;
  run_id: string;
  tags: string[];
  metadata: {
    thread_id: string;
    langgraph_step: number;
    langgraph_node: string;
    langgraph_triggers: string[];
    langgraph_task_idx: number;
    thread_ts: string;
  };
  data: {
    input: {
      query: string;
    };
  };
  parent_ids: string[];
};

type LangGraphOnToolEndEvent = {
  event: LangGraphEventTypes.OnToolEnd;
  name: string;
  run_id: string;
  tags: string[];
  metadata: {
    thread_id: string;
    langgraph_step: number;
    langgraph_node: string;
    langgraph_triggers: string[];
    langgraph_task_idx: number;
    thread_ts: string;
  };
  data: {
    input: {
      query: string;
    };
    output: {
      lc: number;
      type: string;
      id: string[];
      kwargs: {
        content: string[];
        type: string;
        name: string;
        tool_call_id: string;
        status: string;
      };
    };
  };
  parent_ids: string[];
};

type LangGraphOnCustomEvent = {
  event: LangGraphEventTypes.OnCustomEvent;
  run_id: string;
  name: string;
  tags: string[];
  metadata: {
    thread_id: string;
    langgraph_step: number;
    langgraph_node: string;
    langgraph_triggers: string[];
    langgraph_path: [string, string];
    langgraph_checkpoint_ns: string;
    checkpoint_ns: string;
  };
  data: any;
  parent_ids: string[];
};

interface LangGraphInterruptEvent {
  event: LangGraphEventTypes.OnInterrupt;
  value: string;
}

export type LangGraphEvent =
  | LangGraphOnChainStartEvent
  | LangGraphOnChainStreamEvent
  | LangGraphOnChainEndEvent
  | LangGraphOnChatModelStartEvent
  | LangGraphOnChatModelStreamEvent
  | LangGraphOnChatModelEndEvent
  | LangGraphOnToolStartEvent
  | LangGraphOnToolEndEvent
  | LangGraphOnCopilotKitStateSyncEvent
  | LangGraphOnCustomEvent
  | LangGraphInterruptEvent;
