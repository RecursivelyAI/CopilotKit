import { catchError, mergeMap, ReplaySubject, scan } from "rxjs";
import { CustomEventNames, LangGraphEvent, LangGraphEventTypes } from "./events";
import {
  RuntimeEvent,
  RuntimeEventTypes,
  RuntimeMetaEventName,
} from "../../service-adapters/events";
import { randomId } from "@copilotkit/shared";

interface LangGraphEventWithState {
  event: LangGraphEvent | null;

  isMessageStart: boolean;
  isMessageEnd: boolean;
  isToolCallStart: boolean;
  isToolCallEnd: boolean;
  isToolCall: boolean;

  lastMessageId: string | null;
  lastToolCallId: string | null;
  lastToolCallName: string | null;
  currentContent: string | null;
}

export class RemoteLangGraphEventSource {
  public eventStream$ = new ReplaySubject<LangGraphEvent>();

  private shouldEmitToolCall(
    shouldEmitToolCalls: string | string[] | boolean,
    toolCallName: string,
  ) {
    if (typeof shouldEmitToolCalls === "boolean") {
      return shouldEmitToolCalls;
    }
    if (Array.isArray(shouldEmitToolCalls)) {
      return shouldEmitToolCalls.includes(toolCallName);
    }
    return shouldEmitToolCalls === toolCallName;
  }

  private getCurrentContent(event: LangGraphEvent) {
    // @ts-expect-error -- LangGraph Platform implementation stores data outside of kwargs
    const content = event.data?.chunk?.kwargs?.content ?? event.data?.chunk?.content;

    if (!content) {
      const toolCallChunks = this.getCurrentToolCallChunks(event) ?? [];
      for (const chunk of toolCallChunks) {
        if (chunk.args) {
          return chunk.args;
        }
      }
    }

    if (typeof content === "string") {
      return content;
    } else if (Array.isArray(content) && content.length > 0) {
      return content[0].text;
    }

    return null;
  }

  private getCurrentMessageId(event: LangGraphEvent) {
    // @ts-expect-error -- LangGraph Platform implementation stores data outside of kwargs
    return event.data?.chunk?.kwargs?.id ?? event.data?.chunk?.id;
  }

  private getCurrentToolCallChunks(event: LangGraphEvent) {
    // @ts-expect-error -- LangGraph Platform implementation stores data outside of kwargs
    return event.data?.chunk?.kwargs?.tool_call_chunks ?? event.data?.chunk?.tool_call_chunks;
  }

  private getResponseMetadata(event: LangGraphEvent) {
    // @ts-expect-error -- LangGraph Platform implementation stores data outside of kwargs
    return event.data?.chunk?.kwargs?.response_metadata ?? event.data?.chunk?.response_metadata;
  }

  processLangGraphEvents() {
    let lastEventWithState: LangGraphEventWithState | null = null;

    return this.eventStream$.pipe(
      scan(
        (acc, event) => {
          if (event.event === LangGraphEventTypes.OnChatModelStream) {
            const prevMessageId = acc.lastMessageId;
            acc.currentContent = this.getCurrentContent(event);
            acc.lastMessageId = this.getCurrentMessageId(event) ?? acc.lastMessageId;
            const toolCallChunks = this.getCurrentToolCallChunks(event) ?? [];
            const responseMetadata = this.getResponseMetadata(event);

            acc.isToolCallStart = toolCallChunks.some((chunk: any) => chunk.name && chunk.id);
            acc.isMessageStart = prevMessageId !== acc.lastMessageId && !acc.isToolCallStart;
            acc.isToolCall = toolCallChunks && toolCallChunks.length > 0;
            acc.isToolCallEnd = responseMetadata?.finish_reason === "tool_calls";
            acc.isMessageEnd = responseMetadata?.finish_reason === "stop";
            ({ name: acc.lastToolCallName, id: acc.lastToolCallId } = toolCallChunks.find(
              (chunk: any) => chunk.name && chunk.id,
            ) ?? { name: acc.lastToolCallName, id: acc.lastToolCallId });
          }
          acc.event = event;
          lastEventWithState = acc; // Capture the state
          return acc;
        },
        {
          event: null,
          isMessageStart: false,
          isMessageEnd: false,
          isToolCallStart: false,
          isToolCallEnd: false,
          isToolCall: false,
          lastMessageId: null,
          lastToolCallId: null,
          lastToolCallName: null,
          currentContent: null,
        } as LangGraphEventWithState,
      ),
      mergeMap((acc): RuntimeEvent[] => {
        const events: RuntimeEvent[] = [];

        let shouldEmitMessages = true;
        let shouldEmitToolCalls: string | string[] | boolean = true;

        if (acc.event.event == LangGraphEventTypes.OnChatModelStream) {
          if ("copilotkit:emit-tool-calls" in (acc.event.metadata || {})) {
            shouldEmitToolCalls = acc.event.metadata["copilotkit:emit-tool-calls"];
          }
          if ("copilotkit:emit-messages" in (acc.event.metadata || {})) {
            shouldEmitMessages = acc.event.metadata["copilotkit:emit-messages"];
          }
        }

        if (acc.event.event === LangGraphEventTypes.OnInterrupt) {
          events.push({
            type: RuntimeEventTypes.MetaEvent,
            name: RuntimeMetaEventName.LangGraphInterruptEvent,
            value: acc.event.value,
          });
        }

        const responseMetadata = this.getResponseMetadata(acc.event);

        // Tool call ended: emit ActionExecutionEnd
        if (
          responseMetadata?.finish_reason === "tool_calls" &&
          this.shouldEmitToolCall(shouldEmitToolCalls, acc.lastToolCallName)
        ) {
          events.push({
            type: RuntimeEventTypes.ActionExecutionEnd,
            actionExecutionId: acc.lastToolCallId,
          });
        }

        // Message ended: emit TextMessageEnd
        if (responseMetadata?.finish_reason === "stop" && shouldEmitMessages) {
          events.push({
            type: RuntimeEventTypes.TextMessageEnd,
            messageId: acc.lastMessageId,
          });
        }

        switch (acc.event!.event) {
          //
          // Custom events
          //
          case LangGraphEventTypes.OnCustomEvent:
            //
            // Manually emit a message
            //
            if (acc.event.name === CustomEventNames.CopilotKitManuallyEmitMessage) {
              events.push({
                type: RuntimeEventTypes.TextMessageStart,
                messageId: acc.event.data.message_id,
              });
              events.push({
                type: RuntimeEventTypes.TextMessageContent,
                messageId: acc.event.data.message_id,
                content: acc.event.data.message,
              });
              events.push({
                type: RuntimeEventTypes.TextMessageEnd,
                messageId: acc.event.data.message_id,
              });
            }
            //
            // Manually emit a tool call
            //
            else if (acc.event.name === CustomEventNames.CopilotKitManuallyEmitToolCall) {
              events.push({
                type: RuntimeEventTypes.ActionExecutionStart,
                actionExecutionId: acc.event.data.id,
                actionName: acc.event.data.name,
                parentMessageId: acc.event.data.id,
              });
              events.push({
                type: RuntimeEventTypes.ActionExecutionArgs,
                actionExecutionId: acc.event.data.id,
                args: JSON.stringify(acc.event.data.args),
              });
              events.push({
                type: RuntimeEventTypes.ActionExecutionEnd,
                actionExecutionId: acc.event.data.id,
              });
            }
            break;
          case LangGraphEventTypes.OnCopilotKitStateSync:
            events.push({
              type: RuntimeEventTypes.AgentStateMessage,
              threadId: acc.event.thread_id,
              role: acc.event.role,
              agentName: acc.event.agent_name,
              nodeName: acc.event.node_name,
              runId: acc.event.run_id,
              active: acc.event.active,
              state: JSON.stringify(acc.event.state),
              running: acc.event.running,
            });
            break;
          case LangGraphEventTypes.OnChatModelStream:
            if (
              acc.isToolCallStart &&
              this.shouldEmitToolCall(shouldEmitToolCalls, acc.lastToolCallName)
            ) {
              events.push({
                type: RuntimeEventTypes.ActionExecutionStart,
                actionExecutionId: acc.lastToolCallId,
                actionName: acc.lastToolCallName,
                parentMessageId: acc.lastMessageId,
              });
            }
            // Message started: emit TextMessageStart
            else if (acc.isMessageStart && shouldEmitMessages) {
              events.push({
                type: RuntimeEventTypes.TextMessageStart,
                messageId: acc.lastMessageId,
              });
            }

            // Tool call args: emit ActionExecutionArgs
            if (
              acc.isToolCall &&
              acc.currentContent &&
              this.shouldEmitToolCall(shouldEmitToolCalls, acc.lastToolCallName)
            ) {
              events.push({
                type: RuntimeEventTypes.ActionExecutionArgs,
                actionExecutionId: acc.lastToolCallId,
                args: acc.currentContent,
              });
            }
            // Message content: emit TextMessageContent
            else if (!acc.isToolCall && acc.currentContent && shouldEmitMessages) {
              events.push({
                type: RuntimeEventTypes.TextMessageContent,
                messageId: acc.lastMessageId,
                content: acc.currentContent,
              });
            }
            break;
        }
        return events;
      }),
      catchError((error) => {
        console.error(error);
        const events: RuntimeEvent[] = [];

        if (lastEventWithState?.lastMessageId && !lastEventWithState.isToolCall) {
          events.push({
            type: RuntimeEventTypes.TextMessageEnd,
            messageId: lastEventWithState.lastMessageId,
          });
        }
        if (lastEventWithState?.lastToolCallId) {
          events.push({
            type: RuntimeEventTypes.ActionExecutionEnd,
            actionExecutionId: lastEventWithState.lastToolCallId,
          });
        }

        const messageId = randomId();

        events.push({
          type: RuntimeEventTypes.TextMessageStart,
          messageId: messageId,
        });
        events.push({
          type: RuntimeEventTypes.TextMessageContent,
          messageId: messageId,
          content: "❌ An error occurred. Please try again.",
        });
        events.push({
          type: RuntimeEventTypes.TextMessageEnd,
          messageId: messageId,
        });

        return events;
      }),
    );
  }
}
