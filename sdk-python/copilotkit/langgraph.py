"""
LangChain specific utilities for CopilotKit
"""

import uuid
import json
import warnings
from typing import List, Optional, Any, Union, Dict, Callable, cast
import asyncio

from langchain_core.messages import (
    HumanMessage,
    SystemMessage,
    BaseMessage,
    AIMessage,
    ToolMessage
)
from langchain_core.runnables import RunnableConfig
from langchain_core.callbacks.manager import adispatch_custom_event

from .types import Message, IntermediateStateConfig
from .logging import get_logger

logger = get_logger(__name__)



def copilotkit_messages_to_langchain(
        use_function_call: bool = False
    ) -> Callable[[List[Message]], List[BaseMessage]]:
    """
    Convert CopilotKit messages to LangChain messages
    """
    def _copilotkit_messages_to_langchain(messages: List[Message]) -> List[BaseMessage]:
        result = []
        processed_action_executions = set()
        for message in cast(Any, messages):
            if message["type"] == "TextMessage":
                if message["role"] == "user":
                    result.append(HumanMessage(content=message["content"], id=message["id"]))
                elif message["role"] == "system":
                    result.append(SystemMessage(content=message["content"], id=message["id"]))
                elif message["role"] == "assistant":
                    result.append(AIMessage(content=message["content"], id=message["id"]))
            elif message["type"] == "ActionExecutionMessage":
                if use_function_call:
                    result.append(AIMessage(
                        id=message["id"],
                        content="",
                        additional_kwargs={
                            'function_call':{
                                'name': message["name"],
                                'arguments': json.dumps(message["arguments"]),
                            }
                        } 
                    ))
                else:
                    # convert multiple tool calls to a single message
                    message_id = message.get("parentMessageId", message["id"])
                    if message_id in processed_action_executions:
                        continue

                    processed_action_executions.add(message_id)

                    all_tool_calls = []

                    # Find all tool calls for this message
                    for msg in messages:
                        if msg.get("parentMessageId", None) == message_id or msg["id"] == message_id:
                            all_tool_calls.append(msg)

                    tool_calls = [{
                        "name": t["name"],
                        "args": t["arguments"],
                        "id": t["id"],
                    } for t in all_tool_calls]

                    result.append(
                        AIMessage(
                            id=message_id,
                            content="",
                            tool_calls=tool_calls
                        )
                    )

            elif message["type"] == "ResultMessage":
                result.append(ToolMessage(
                    id=message["id"],
                    content=message["result"],
                    name=message["actionName"],
                    tool_call_id=message["actionExecutionId"]
                ))

        return result

    return _copilotkit_messages_to_langchain


def langchain_messages_to_copilotkit(
        messages: List[BaseMessage]
    ) -> List[Message]:
    """
    Convert LangChain messages to CopilotKit messages
    """
    result = []
    tool_call_names = {}

    for message in messages:
        if isinstance(message, AIMessage):
            for tool_call in message.tool_calls or []:
                tool_call_names[tool_call["id"]] = tool_call["name"]

    for message in messages:
        content = None

        if hasattr(message, "content"):
            content = message.content

            # Check if content is a list and use the first element
            if isinstance(content, list):
                content = content[0]

            # Anthropic models return a dict with a "text" key
            if isinstance(content, dict):
                content = content.get("text", "")

        if isinstance(message, HumanMessage):
            result.append({
                "role": "user",
                "content": content,
                "id": message.id,
            })
        elif isinstance(message, SystemMessage):
            result.append({
                "role": "system",
                "content": content,
                "id": message.id,
            })
        elif isinstance(message, AIMessage):
            if message.tool_calls:
                for tool_call in message.tool_calls:
                    result.append({
                        "id": tool_call["id"],
                        "name": tool_call["name"],
                        "arguments": tool_call["args"],
                        "parentMessageId": message.id,
                    })
            else:
                result.append({
                    "role": "assistant",
                    "content": content,
                    "id": message.id,
                    "parentMessageId": message.id,
                })
        elif isinstance(message, ToolMessage):
            result.append({
                "actionExecutionId": message.tool_call_id,
                "actionName": tool_call_names.get(message.tool_call_id, message.name or ""),
                "result": content,
                "id": message.id,
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
        if "arguments" in msg:
            msg_id = msg["id"]
            if msg_id in results_dict:
                reordered_result.append(results_dict[msg_id])
            else:
                logger.warning("Tool call result message not found for id: %s", msg_id)

    return reordered_result

def copilotkit_customize_config(
        base_config: Optional[RunnableConfig] = None,
        *,
        emit_messages: Optional[bool] = None,
        emit_tool_calls: Optional[Union[bool, str, List[str]]] = None,
        emit_intermediate_state: Optional[List[IntermediateStateConfig]] = None,
        emit_all: Optional[bool] = None, # deprecated
    ) -> RunnableConfig:
    """
    Customize the LangGraph configuration for use in CopilotKit.

    To the CopilotKit SDK, run:

    ```bash
    pip install copilotkit
    ```

    ### Examples

    Disable emitting messages and tool calls:
    
    ```python
    from copilotkit.langgraph import copilotkit_customize_config

    config = copilotkit_customize_config(
        config,
        emit_messages=False,
        emit_tool_calls=False
    )
    ```

    To emit a tool call as streaming LangGraph state, pass the destination key in state,
    the tool name and optionally the tool argument. (If you don't pass the argument name,
    all arguments are emitted under the state key.)

    ```python
    from copilotkit.langgraph import copilotkit_customize_config

    config = copilotkit_customize_config(
        config,
        emit_intermediate_state=[
           {
                "state_key": "steps",
                "tool": "SearchTool",
                "tool_argument": "steps"
            },
        ]
    )
    ```

    Parameters
    ----------
    base_config : Optional[RunnableConfig]
        The LangChain/LangGraph configuration to customize. Pass None to make a new configuration.
    emit_messages : Optional[bool]
        Configure how messages are emitted. By default, all messages are emitted. Pass False to
        disable emitting messages.
    emit_tool_calls : Optional[Union[bool, str, List[str]]]
        Configure how tool calls are emitted. By default, all tool calls are emitted. Pass False to
        disable emitting tool calls. Pass a string or list of strings to emit only specific tool calls.
    emit_intermediate_state : Optional[List[IntermediateStateConfig]]
        Lets you emit tool calls as streaming LangGraph state.

    Returns
    -------
    RunnableConfig
        The customized LangGraph configuration.
    """
    if emit_all is not None:
        warnings.warn(
            "The `emit_all` parameter is deprecated and will be removed in a future version. "
            "CopilotKit will now emit all messages and tool calls by default.",
            DeprecationWarning,
            stacklevel=2
        )
    metadata = base_config.get("metadata", {}) if base_config else {}

    if emit_all is True:
        metadata["copilotkit:emit-tool-calls"] = True
        metadata["copilotkit:emit-messages"] = True
    else:
        if emit_tool_calls is not None:
            metadata["copilotkit:emit-tool-calls"] = emit_tool_calls
        if emit_messages is not None:
            metadata["copilotkit:emit-messages"] = emit_messages

    if emit_intermediate_state:
        metadata["copilotkit:emit-intermediate-state"] = emit_intermediate_state

    base_config = base_config or {}

    return {
        **base_config,
        "metadata": metadata
    }


async def copilotkit_exit(config: RunnableConfig):
    """
    Exits the current agent after the run completes. Calling copilotkit_exit() will
    not immediately stop the agent. Instead, it signals to CopilotKit to stop the agent after
    the run completes.

    ### Examples

    ```python
    from copilotkit.langgraph import copilotkit_exit

    def my_node(state: Any):
        await copilotkit_exit(config)
        return state
    ```

    Parameters
    ----------
    config : RunnableConfig
        The LangGraph configuration.

    Returns
    -------
    Awaitable[bool]
        Always return True.
    """

    await adispatch_custom_event(
        "copilotkit_exit",
        {},
        config=config,
    )
    await asyncio.sleep(0.02)

    return True

async def copilotkit_emit_state(config: RunnableConfig, state: Any):
    """
    Emits intermediate state to CopilotKit. Useful if you have a longer running node and you want to
    update the user with the current state of the node.

    ### Examples

    ```python
    from copilotkit.langgraph import copilotkit_emit_state

    for i in range(10):
        await some_long_running_operation(i)
        await copilotkit_emit_state(config, {"progress": i})
    ```

    Parameters
    ----------
    config : RunnableConfig
        The LangGraph configuration.
    state : Any
        The state to emit (Must be JSON serializable).

    Returns
    -------
    Awaitable[bool]
        Always return True.
    """

    await adispatch_custom_event(
        "copilotkit_manually_emit_intermediate_state",
        state,
        config=config,
    )
    await asyncio.sleep(0.02)

    return True

async def copilotkit_emit_message(config: RunnableConfig, message: str):
    """
    Manually emits a message to CopilotKit. Useful in longer running nodes to update the user.
    Important: You still need to return the messages from the node.

    ### Examples

    ```python
    from copilotkit.langgraph import copilotkit_emit_message

    message = "Step 1 of 10 complete"
    await copilotkit_emit_message(config, message)

    # Return the message from the node
    return {
        "messages": [AIMessage(content=message)]
    }
    ```

    Parameters
    ----------
    config : RunnableConfig
        The LangGraph configuration.
    message : str
        The message to emit.

    Returns
    -------
    Awaitable[bool]
        Always return True.
    """
    await adispatch_custom_event(
        "copilotkit_manually_emit_message",
        {
            "message": message,
            "message_id": str(uuid.uuid4()),
            "role": "assistant"
        },
        config=config,
    )
    await asyncio.sleep(0.02)

    return True


async def copilotkit_emit_tool_call(config: RunnableConfig, *, name: str, args: Dict[str, Any]):
    """
    Manually emits a tool call to CopilotKit.

    ```python
    from copilotkit.langgraph import copilotkit_emit_tool_call

    await copilotkit_emit_tool_call(config, name="SearchTool", args={"steps": 10})
    ```

    Parameters
    ----------
    config : RunnableConfig
        The LangGraph configuration.
    name : str
        The name of the tool to emit.
    args : Dict[str, Any]
        The arguments to emit.

    Returns
    -------
    Awaitable[bool]
        Always return True.
    """

    await adispatch_custom_event(
        "copilotkit_manually_emit_tool_call",
        {
            "name": name,
            "args": args,
            "id": str(uuid.uuid4())
        },
        config=config,
    )
    await asyncio.sleep(0.02)

    return True
