"""
CopilotKit Protocol
"""

import json
from enum import Enum
from typing import Union, Optional
from typing_extensions import TypedDict, Literal, Any

class RuntimeEventTypes(Enum):
    """CopilotKit Runtime Event Types"""
    TEXT_MESSAGE_START = "TextMessageStart"
    TEXT_MESSAGE_CONTENT = "TextMessageContent"
    TEXT_MESSAGE_END = "TextMessageEnd"
    ACTION_EXECUTION_START = "ActionExecutionStart"
    ACTION_EXECUTION_ARGS = "ActionExecutionArgs"
    ACTION_EXECUTION_END = "ActionExecutionEnd"
    ACTION_EXECUTION_RESULT = "ActionExecutionResult"
    AGENT_STATE_MESSAGE = "AgentStateMessage"
    META_EVENT = "MetaEvent"

class RuntimeMetaEventName(Enum):
    """Runtime Meta Event Name"""
    LANG_GRAPH_INTERRUPT_EVENT = "LangGraphInterruptEvent"
    PREDICT_STATE_EVENT = "PredictStateEvent"


class TextMessageStart(TypedDict):
    """Text Message Start Event"""
    type: Literal[RuntimeEventTypes.TEXT_MESSAGE_START]
    messageId: str
    parentMessageId: Optional[str]

class TextMessageContent(TypedDict):
    """Text Message Content Event"""
    type: Literal[RuntimeEventTypes.TEXT_MESSAGE_CONTENT]
    messageId: str
    content: str

class TextMessageEnd(TypedDict):
    """Text Message End Event"""
    type: Literal[RuntimeEventTypes.TEXT_MESSAGE_END]
    messageId: str

class ActionExecutionStart(TypedDict):
    """Action Execution Start Event"""
    type: Literal[RuntimeEventTypes.ACTION_EXECUTION_START]
    actionExecutionId: str
    actionName: str
    parentMessageId: Optional[str]

class ActionExecutionArgs(TypedDict):
    """Action Execution Args Event"""
    type: Literal[RuntimeEventTypes.ACTION_EXECUTION_ARGS]
    actionExecutionId: str
    args: str

class ActionExecutionEnd(TypedDict):
    """Action Execution End Event"""
    type: Literal[RuntimeEventTypes.ACTION_EXECUTION_END]
    actionExecutionId: str

class ActionExecutionResult(TypedDict):
    """Action Execution Result Event"""
    type: Literal[RuntimeEventTypes.ACTION_EXECUTION_RESULT]
    actionName: str
    actionExecutionId: str
    result: str

class AgentStateMessage(TypedDict):
    """Agent State Message Event"""
    type: Literal[RuntimeEventTypes.AGENT_STATE_MESSAGE]
    threadId: str
    agentName: str
    nodeName: str
    runId: str
    active: bool
    role: str
    state: str
    running: bool

class MetaEvent(TypedDict):
    """Meta Event"""
    type: Literal[RuntimeEventTypes.META_EVENT]
    name: RuntimeMetaEventName
    value: Any

RuntimeEvent = Union[
    TextMessageStart,
    TextMessageContent,
    TextMessageEnd,
    ActionExecutionStart,
    ActionExecutionArgs,
    ActionExecutionEnd,
    ActionExecutionResult,
    AgentStateMessage,
    MetaEvent
]

def text_message_start(
        *,
        message_id: str,
        parent_message_id: Optional[str] = None
  ) -> TextMessageStart:
    """Utility function to create a text message start event"""
    return {
        "type": RuntimeEventTypes.TEXT_MESSAGE_START,
        "messageId": message_id,
        "parentMessageId": parent_message_id
    }

def text_message_content(*, message_id: str, content: str) -> TextMessageContent:
    """Utility function to create a text message content event"""
    return {
        "type": RuntimeEventTypes.TEXT_MESSAGE_CONTENT,
        "messageId": message_id,
        "content": content
    }

def text_message_end(*, message_id: str) -> TextMessageEnd:
    """Utility function to create a text message end event"""
    return {
        "type": RuntimeEventTypes.TEXT_MESSAGE_END,
        "messageId": message_id
    }

def action_execution_start(
        *,
        action_execution_id: str,
        action_name: str,
        parent_message_id: Optional[str] = None
    ) -> ActionExecutionStart:
    """Utility function to create an action execution start event"""
    return {
        "type": RuntimeEventTypes.ACTION_EXECUTION_START,
        "actionExecutionId": action_execution_id,
        "actionName": action_name,
        "parentMessageId": parent_message_id
    }

def action_execution_args(*, action_execution_id: str, args: str) -> ActionExecutionArgs:
    """Utility function to create an action execution args event"""
    return {
        "type": RuntimeEventTypes.ACTION_EXECUTION_ARGS,
        "actionExecutionId": action_execution_id,
        "args": args
    }

def action_execution_end(*, action_execution_id: str) -> ActionExecutionEnd:
    """Utility function to create an action execution end event"""
    return {
        "type": RuntimeEventTypes.ACTION_EXECUTION_END,
        "actionExecutionId": action_execution_id
    }

def action_execution_result(
        *,
        action_name: str,
        action_execution_id: str,
        result: str
    ) -> ActionExecutionResult:
    """Utility function to create an action execution result event"""
    return {
        "type": RuntimeEventTypes.ACTION_EXECUTION_RESULT,
        "actionName": action_name,
        "actionExecutionId": action_execution_id,
        "result": result
    }

def agent_state_message( # pylint: disable=too-many-arguments
        *,
        thread_id: str,
        agent_name: str,
        node_name: str,
        run_id: str,
        active: bool,
        role: str,
        state: str,
        running: bool
  ) -> AgentStateMessage:
    """Utility function to create an agent state message event"""
    return {
        "type": RuntimeEventTypes.AGENT_STATE_MESSAGE,
        "threadId": thread_id,
        "agentName": agent_name,
        "nodeName": node_name,
        "runId": run_id,
        "active": active,
        "role": role,
        "state": state,
        "running": running
    }

def meta_event(*, name: RuntimeMetaEventName, value: Any) -> MetaEvent:
    """Utility function to create a meta event"""
    return {
        "type": RuntimeEventTypes.META_EVENT,
        "name": name,
        "value": value
    }

def emit_runtime_events(*events: RuntimeEvent) -> str:
    """Emit a list of runtime events"""
    def serialize_event(event):
        # Convert enum values to their string representation
        if isinstance(event, dict):
            return {k: (v.value if isinstance(v, Enum) else v) for k, v in event.items()}
        return event

    return "\n".join(json.dumps(serialize_event(event)) for event in events) + "\n"

def emit_runtime_event(event: RuntimeEvent) -> str:
    """Emit a single runtime event"""
    return emit_runtime_events(event)
