"""
CrewAI integration for CopilotKit
"""

import uuid
import threading
import queue
import json
from enum import Enum
from typing_extensions import TypedDict, Any, Dict, Optional, List, Literal
from pydantic import BaseModel
from litellm.types.utils import (
  ModelResponse,
  Choices,
  Message as LiteLLMMessage,
  ChatCompletionMessageToolCall,
  Function as LiteLLMFunction
)
from litellm.litellm_core_utils.streaming_handler import CustomStreamWrapper
from crewai.flow.flow import FlowState, Flow
from crewai.flow.flow_events import (
  Event as CrewAIFlowEvent,
  FlowStartedEvent as CrewAIFlowStartedEvent,
  MethodExecutionStartedEvent as CrewAIFlowMethodExecutionStartedEvent,
  MethodExecutionFinishedEvent as CrewAIFlowMethodExecutionFinishedEvent,
  FlowFinishedEvent as CrewAIFlowFinishedEvent,
)
from .types import Message
from .logging import get_logger

logger = get_logger(__name__)

class CopilotKitProperties(BaseModel):
    """CopilotKit properties"""
    actions: List[Any]

class CopilotKitState(FlowState):
    """CopilotKit state"""
    messages: List[Any]
    copilotkit: CopilotKitProperties

_THREAD_LOCAL = threading.local()

def _crewai_flow_thread_runner(flow: Flow, q: queue.Queue, inputs: Dict[str, Any]):
    """
    Runs a flow in a separate thread. Workaround since the flow will use
    asyncio.run().
    """

    _set_crewai_flow_event_queue(q)

    def crewai_flow_event_subscriber(_sender: Any, event: CrewAIFlowEvent):
        if isinstance(event, CrewAIFlowStartedEvent):
            _get_crewai_flow_event_queue().put({
                "type": CopilotKitCrewAIFlowEventType.FLOW_EXECUTION_STARTED
            })
        elif isinstance(event, CrewAIFlowMethodExecutionStartedEvent):
            _get_crewai_flow_event_queue().put({
                "type": CopilotKitCrewAIFlowEventType.METHOD_EXECUTION_STARTED,
                "name": event.method_name
            })
        elif isinstance(event, CrewAIFlowMethodExecutionFinishedEvent):
            _get_crewai_flow_event_queue().put({
                "type": CopilotKitCrewAIFlowEventType.METHOD_EXECUTION_FINISHED,
                "name": event.method_name
            })
        elif isinstance(event, CrewAIFlowFinishedEvent):
            _get_crewai_flow_event_queue().put({
                "type": CopilotKitCrewAIFlowEventType.FLOW_EXECUTION_FINISHED
            })

    flow.event_emitter.connect(crewai_flow_event_subscriber)

    try:
        print("Kicking off flow", flush=True)
        print("Inputs", json.dumps(inputs), flush=True)
        flow.kickoff(inputs=inputs)
    except Exception as e: # pylint: disable=broad-except
        _get_crewai_flow_event_queue().put(CopilotKitCrewAIFlowEventExecutionError(
            type=CopilotKitCrewAIFlowEventType.FLOW_EXECUTION_ERROR,
            error=e
        ))

def _set_crewai_flow_event_queue(q: queue.Queue):
    """
    Store a queue in this thread's local storage.
    """
    _THREAD_LOCAL.crewai_flow_event_queue = q

def _get_crewai_flow_event_queue() -> queue.Queue:
    """
    Retrieve the queue from this thread's local storage (or None if missing).
    """
    q = getattr(_THREAD_LOCAL, "crewai_flow_event_queue", None)
    if q is None:
        raise RuntimeError("No thread-local flow event queue is set in this thread!")
    return q


class CopilotKitPredictStateConfig(TypedDict):
    """
    CopilotKit Predict State Config
    """
    tool_name: str
    tool_argument: Optional[str]

class CopilotKitCrewAIFlowEventType(Enum):
    """
    CopilotKit CrewAI Flow Event Type
    """
    EMIT_STATE = "copilotkit_emit_state"
    EMIT_MESSAGE = "copilotkit_emit_message"
    EMIT_TOOL_CALL = "copilotkit_emit_tool_call"
    EXIT = "copilotkit_exit"
    PREDICT_STATE = "copilotkit_predict_state"
    FLOW_EXECUTION_STARTED = "copilotkit_flow_execution_started"
    FLOW_EXECUTION_FINISHED = "copilotkit_flow_execution_finished"
    METHOD_EXECUTION_STARTED = "copilotkit_method_execution_started"
    METHOD_EXECUTION_FINISHED = "copilotkit_method_execution_finished"
    FLOW_EXECUTION_ERROR = "copilotkit_flow_execution_error"
    TEXT_MESSAGE_START = "copilotkit_text_message_start"
    TEXT_MESSAGE_CONTENT = "copilotkit_text_message_content"
    TEXT_MESSAGE_END = "copilotkit_text_message_end"
    ACTION_EXECUTION_START = "copilotkit_action_execution_start"
    ACTION_EXECUTION_ARGS = "copilotkit_action_execution_args"
    ACTION_EXECUTION_END = "copilotkit_action_execution_end"


class CopilotKitCrewAIFlowEvent(TypedDict):
    """
    CopilotKit CrewAI Flow Event
    """
    type: CopilotKitCrewAIFlowEventType

class CopilotKitCrewAIFlowEventEmitState(TypedDict):
    """
    CopilotKit CrewAI Flow Event Emit State
    """
    type: Literal[CopilotKitCrewAIFlowEventType.EMIT_STATE]
    state: Any

class CopilotKitCrewAIFlowEventEmitMessage(TypedDict):
    """
    CopilotKit CrewAI Flow Event Emit Message
    """
    type: Literal[CopilotKitCrewAIFlowEventType.EMIT_MESSAGE]
    message_id: str
    message: str

class CopilotKitCrewAIFlowEventEmitToolCall(TypedDict):
    """
    CopilotKit CrewAI Flow Event Emit Tool Call
    """
    type: Literal[CopilotKitCrewAIFlowEventType.EMIT_TOOL_CALL]
    message_id: str
    name: str
    args: Dict[str, Any]

class CopilotKitCrewAIFlowEventExit(TypedDict):
    """
    CopilotKit CrewAI Flow Event Exit
    """
    type: Literal[CopilotKitCrewAIFlowEventType.EXIT]

class CopilotKitCrewAIFlowEventPredictState(TypedDict):
    """
    CopilotKit CrewAI Flow Event Predict State
    """
    type: Literal[CopilotKitCrewAIFlowEventType.PREDICT_STATE]
    config: Dict[str, CopilotKitPredictStateConfig]

class CopilotKitCrewAIFlowExecutionStarted(TypedDict):
    """
    CopilotKit CrewAI Flow Event Method Execution Started
    """
    type: Literal[CopilotKitCrewAIFlowEventType.FLOW_EXECUTION_STARTED]

class CopilotKitCrewAIFlowExecutionFinished(TypedDict):
    """
    CopilotKit CrewAI Flow Event Method Execution Finished
    """
    type: Literal[CopilotKitCrewAIFlowEventType.FLOW_EXECUTION_FINISHED]

class CopilotKitCrewAIFlowEventMethodExecutionStarted(TypedDict):
    """
    CopilotKit CrewAI Flow Event Method Execution Started
    """
    type: Literal[CopilotKitCrewAIFlowEventType.METHOD_EXECUTION_STARTED]
    name: str

class CopilotKitCrewAIFlowEventMethodExecutionFinished(TypedDict):
    """
    CopilotKit CrewAI Flow Event Method Execution Finished
    """
    type: Literal[CopilotKitCrewAIFlowEventType.METHOD_EXECUTION_FINISHED]
    name: str

class CopilotKitCrewAIFlowEventExecutionError(TypedDict):
    """
    CopilotKit CrewAI Flow Event Execution Error
    """
    type: Literal[CopilotKitCrewAIFlowEventType.FLOW_EXECUTION_ERROR]
    error: Exception

class CopilotKitCrewAIFlowEventTextMessageStart(TypedDict):
    """
    CopilotKit CrewAI Flow Event Text Message Start
    """
    type: Literal[CopilotKitCrewAIFlowEventType.TEXT_MESSAGE_START]
    message_id: str
    parent_message_id: Optional[str]

class CopilotKitCrewAIFlowEventTextMessageContent(TypedDict):
    """
    CopilotKit CrewAI Flow Event Text Message Content
    """
    type: Literal[CopilotKitCrewAIFlowEventType.TEXT_MESSAGE_CONTENT]
    message_id: str
    content: str

class CopilotKitCrewAIFlowEventTextMessageEnd(TypedDict):
    """
    CopilotKit CrewAI Flow Event Text Message End
    """
    type: Literal[CopilotKitCrewAIFlowEventType.TEXT_MESSAGE_END]
    message_id: str

class CopilotKitCrewAIFlowEventActionExecutionStart(TypedDict):
    """
    CopilotKit CrewAI Flow Event Action Execution Start
    """
    type: Literal[CopilotKitCrewAIFlowEventType.ACTION_EXECUTION_START]
    action_execution_id: str
    action_name: str
    parent_message_id: Optional[str]

class CopilotKitCrewAIFlowEventActionExecutionArgs(TypedDict):
    """
    CopilotKit CrewAI Flow Event Action Execution Args
    """
    type: Literal[CopilotKitCrewAIFlowEventType.ACTION_EXECUTION_ARGS]
    action_execution_id: str
    args: str

class CopilotKitCrewAIFlowEventActionExecutionEnd(TypedDict):
    """
    CopilotKit CrewAI Flow Event Action Execution End
    """
    type: Literal[CopilotKitCrewAIFlowEventType.ACTION_EXECUTION_END]
    action_execution_id: str

# We are leaving all these functions as async- in the future when we
# switch from a separate thread to an async queue, user code will
# still work

async def copilotkit_emit_state(state: Any) -> Literal[True]:
    """
    Emits intermediate state to CopilotKit. 
    Useful if you have a longer running node and you want to update the user with the current state of the node.

    To install the CopilotKit SDK, run:

    ```bash
    pip install copilotkit
    ```

    ### Examples

    ```python
    from copilotkit.crewai import copilotkit_emit_state

    for i in range(10):
        await some_long_running_operation(i)
        await copilotkit_emit_state({"progress": i})
    ```

    Parameters
    ----------
    state : Any
        The state to emit (Must be JSON serializable).

    Returns
    -------
    Awaitable[bool]
        Always return True.

    """
    _get_crewai_flow_event_queue().put(
        CopilotKitCrewAIFlowEventEmitState(
            type=CopilotKitCrewAIFlowEventType.EMIT_STATE,
            state=state
        )
    )

    return True

async def copilotkit_emit_message(message: str) -> str:
    """
    Manually emits a message to CopilotKit. Useful in longer running nodes to update the user.
    Important: You still need to return the messages from the node.

    ### Examples

    ```python
    from copilotkit.crewai import copilotkit_emit_message

    message = "Step 1 of 10 complete"
    await copilotkit_emit_message(message)

    # Return the message from the node
    return {
        "messages": [AIMessage(content=message)]
    }
    ```

    Parameters
    ----------
    message : str
        The message to emit.

    Returns
    -------
    Awaitable[bool]
        Always return True.
    """
    message_id = str(uuid.uuid4())

    _get_crewai_flow_event_queue().put(
        CopilotKitCrewAIFlowEventEmitMessage(
            type=CopilotKitCrewAIFlowEventType.EMIT_MESSAGE,
            message_id=message_id,
            message=message
        )
    )

    return message_id

async def copilotkit_emit_tool_call(*, name: str, args: Dict[str, Any]) -> str:
    """
    Manually emits a tool call to CopilotKit.

    ```python
    from copilotkit.crewai import copilotkit_emit_tool_call

    await copilotkit_emit_tool_call(name="SearchTool", args={"steps": 10})
    ```

    Parameters
    ----------
    name : str
        The name of the tool to emit.
    args : Dict[str, Any]
        The arguments to emit.

    Returns
    -------
    Awaitable[bool]
        Always return True.
    """
    message_id = str(uuid.uuid4())
    _get_crewai_flow_event_queue().put(
        CopilotKitCrewAIFlowEventEmitToolCall(
            type=CopilotKitCrewAIFlowEventType.EMIT_TOOL_CALL,
            message_id=message_id,
            name=name,
            args=args
        )
    )
    return message_id


def copilotkit_stream(response):
    """
    Stream litellm responses token by token to CopilotKit.

    ```python
    response = copilotkit_stream(
        completion(
            model="openai/gpt-4o",
            messages=messages,
            tools=tools,
            stream=True # this must be set to True for streaming
        )
    )
    ```
    """
    if isinstance(response, ModelResponse):
        return _copilotkit_stream_response(response)
    if isinstance(response, CustomStreamWrapper):
        return _copilotkit_stream_custom_stream_wrapper(response)
    raise ValueError("Invalid response type")


def _copilotkit_stream_custom_stream_wrapper(response: CustomStreamWrapper):
    q = _get_crewai_flow_event_queue()
    message_id: str = ""
    tool_call_id: str = ""
    content = ""
    created = 0
    model = ""
    system_fingerprint = ""
    finish_reason=None
    mode = None
    all_tool_calls = []

    for chunk in response:
        if message_id is None:
            message_id = chunk["id"]

        tool_calls = chunk["choices"][0]["delta"]["tool_calls"]
        finish_reason = chunk["choices"][0]["finish_reason"]
        created = chunk["created"]
        model = chunk["model"]
        system_fingerprint = chunk["system_fingerprint"]

        if mode == "text" and (tool_calls is not None or finish_reason is not None):
            # end the current text message
            q.put(CopilotKitCrewAIFlowEventTextMessageEnd(
                type=CopilotKitCrewAIFlowEventType.TEXT_MESSAGE_END,
                message_id=message_id
            ))
        elif mode == "tool" and (tool_calls is None or finish_reason is not None):
            # end the current tool call
            q.put(CopilotKitCrewAIFlowEventActionExecutionEnd(
                type=CopilotKitCrewAIFlowEventType.ACTION_EXECUTION_END,
                action_execution_id=tool_call_id
            ))

        if finish_reason is not None:
            break

        if mode != "text" and tool_calls is None:
            # start a new text message
            q.put(CopilotKitCrewAIFlowEventTextMessageStart(
                type=CopilotKitCrewAIFlowEventType.TEXT_MESSAGE_START,
                message_id=message_id,
                parent_message_id=None
            ))
        elif mode != "tool" and tool_calls is not None and tool_calls[0].id is not None:
            # start a new tool call
            tool_call_id = tool_calls[0].id

            q.put(CopilotKitCrewAIFlowEventActionExecutionStart(
                type=CopilotKitCrewAIFlowEventType.ACTION_EXECUTION_START,
                action_execution_id=tool_call_id,
                action_name=tool_calls[0].function["name"],
                parent_message_id=message_id
            ))

            all_tool_calls.append(
                {
                    "id": tool_call_id,
                    "name": tool_calls[0].function["name"],
                    "arguments": "",
                }
            )

        mode = "tool" if tool_calls is not None else "text"

        if mode == "text":
            text_content = chunk["choices"][0]["delta"]["content"]
            if text_content is not None:
                content += text_content
                q.put(CopilotKitCrewAIFlowEventTextMessageContent(
                    type=CopilotKitCrewAIFlowEventType.TEXT_MESSAGE_CONTENT,
                    message_id=message_id,
                    content=text_content
                ))

        elif mode == "tool":
            tool_arguments = tool_calls[0].function["arguments"]
            if tool_arguments is not None:
                q.put(CopilotKitCrewAIFlowEventActionExecutionArgs(
                    type=CopilotKitCrewAIFlowEventType.ACTION_EXECUTION_ARGS,
                    action_execution_id=tool_call_id,
                    args=tool_arguments
                ))

                all_tool_calls[-1]["arguments"] += tool_arguments

    tool_calls = [
        ChatCompletionMessageToolCall(
            function=LiteLLMFunction(
                arguments=tool_call["arguments"],
                name=tool_call["name"]
            ),
            id=tool_call["id"],
            type="function"
        )
        for tool_call in all_tool_calls
    ]
    return ModelResponse(
        id=message_id,
        created=created,
        model=model,
        object='chat.completion',
        system_fingerprint=system_fingerprint,
        choices=[
            Choices(
                finish_reason=finish_reason,
                index=0,
                message=LiteLLMMessage(
                    content=content,
                    role='assistant',
                    tool_calls=tool_calls if len(tool_calls) > 0 else None,
                    function_call=None
                )
            )
        ]
    )

def _copilotkit_stream_response(response: ModelResponse):
    return response


async def copilotkit_exit() -> Literal[True]:
    """
    Exits the current agent after the run completes. Calling copilotkit_exit() will
    not immediately stop the agent. Instead, it signals to CopilotKit to stop the agent after
    the run completes.

    ### Examples

    ```python
    from copilotkit.crewai import copilotkit_exit

    def my_function():
        await copilotkit_exit()
        return state
    ```

    Returns
    -------
    Awaitable[bool]
        Always return True.
    """
    _get_crewai_flow_event_queue().put(CopilotKitCrewAIFlowEventExit(
        type=CopilotKitCrewAIFlowEventType.EXIT
    ))
    return True


async def copilotkit_predict_state(
        config: Dict[str, CopilotKitPredictStateConfig]
    ) -> Literal[True]:
    """
    Stream tool calls as state to CopilotKit.

    To emit a tool call as streaming CrewAI state, pass the destination key in state,
    the tool name and optionally the tool argument. (If you don't pass the argument name,
    all arguments are emitted under the state key.)

    ```python
    from copilotkit.crewai import copilotkit_predict_state

    await copilotkit_predict_state(
        {
            "steps": {
                "tool_name": "SearchTool",
                "tool_argument": "steps",
            },
        }
    )
    ```

    Parameters
    ----------
    config : Dict[str, CopilotKitPredictStateConfig]
        The configuration to predict the state.

    Returns
    -------
    Awaitable[bool]
        Always return True.
    """
    _get_crewai_flow_event_queue().put(CopilotKitCrewAIFlowEventPredictState(
        type=CopilotKitCrewAIFlowEventType.PREDICT_STATE,
        config=config
    ))
    return True


def copilotkit_messages_to_crewai_flow(messages: List[Message]) -> List[Any]:
    """
    Convert CopilotKit messages to CrewAI Flow messages
    """
    result = []
    processed_action_executions = set()

    for message in messages:
        message_id = message["id"]
        message_type = message.get("type")

        if message_type == "TextMessage":
            result.append({
                "id": message_id,
                "role": message.get("role"),
                "content": message.get("content")
            })
        elif message_type == "ActionExecutionMessage":
            # convert multiple tool calls to a single message
            original_message_id = message.get("parentMessageId", message_id)
            if original_message_id in processed_action_executions:
                continue

            processed_action_executions.add(original_message_id)

            all_tool_calls = []

            # Find all tool calls for this message
            for msg in messages:
                msg_id = msg["id"]
                if (msg.get("parentMessageId", None) == original_message_id or
                    msg_id == original_message_id):
                    all_tool_calls.append(msg)

            tool_calls = [
                {
                    "type": "function",
                    "function": {
                        "name": t["name"],
                        "arguments": json.dumps(t["arguments"]),
                    },
                    "id": t["id"],
                } for t in all_tool_calls]

            result.append(
                {
                    "id": original_message_id,
                    "role": "assistant",
                    "content": "",
                    "tool_calls": tool_calls
                }
            )

        elif message_type == "ResultMessage":
            result.append(
                {
                    "id": message_id,
                    "role": "tool",
                    "tool_call_id": message.get("actionExecutionId"),
                    "content": message.get("result"),
                }
            )

    return result

def crewai_flow_messages_to_copilotkit(messages: List[Dict]) -> List[Message]: # pylint: disable=too-many-branches
    """
    Convert CrewAI Flow messages to CopilotKit messages
    """
    result = []
    tool_call_names = {}

    message_ids = {
        id(m): m.get("id", str(uuid.uuid4())) for m in messages
    }

    for message in messages:
        if "content" in message and message.get("role") == "assistant":
            for tool_call in message.get("tool_calls", []):
                tool_call_names[tool_call["id"]] = tool_call["function"]["name"]

    for message in messages:
        message_id = message_ids[id(message)]

        if message.get("role") == "tool":
            result.append({
                "actionExecutionId": message["tool_call_id"],
                "actionName": tool_call_names.get(message["tool_call_id"], message.get("name", "")),
                "result": message["content"],
                "id": message_id,
            })
        elif message.get("tool_calls"):
            for tool_call in message["tool_calls"]:
                if tool_call.get("function"):
                    result.append({
                        "id": tool_call["id"],
                        "name": tool_call["function"]["name"],
                        "arguments": json.loads(tool_call["function"]["arguments"]),
                        "parentMessageId": message_id,
                    })
                else:
                    result.append({
                        "id": tool_call["id"],
                        "name": tool_call["name"],
                        "arguments": tool_call["arguments"],
                        "parentMessageId": message_id,
                    })
        elif message.get("content"):
            result.append({
                "role": message["role"],
                "content": message["content"],
                "id": message_id,
            })

    # Create a dictionary to map message ids to their corresponding messages
    results_dict = {msg["actionExecutionId"]: msg for msg in result if "actionExecutionId" in msg}


    # since we are splitting multiple tool calls into multiple messages,
    # we need to reorder the corresponding result messages to be after the tool call
    reordered_result = []

    for msg in result:

        # add all messages that are not tool call results
        if not "actionExecutionId" in msg:
            reordered_result.append(msg)

        # if the message is a tool call, also add the corresponding result message
        # immediately after the tool call
        if msg.get("name"):
            msg_id = msg["id"]
            if msg_id in results_dict:
                reordered_result.append(results_dict[msg_id])
            else:
                logger.warning("Tool call result message not found for id: %s", msg_id)

    return reordered_result
