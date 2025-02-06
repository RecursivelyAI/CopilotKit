"""Delete Resources"""

import json
from typing import cast
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import ToolMessage, AIMessage
from research_canvas.langgraph.state import AgentState

async def delete_node(state: AgentState, config: RunnableConfig): # pylint: disable=unused-argument
    """
    Delete Node
    """
    return state

async def perform_delete_node(state: AgentState, config: RunnableConfig): # pylint: disable=unused-argument
    """
    Perform Delete Node
    """
    ai_message = cast(AIMessage, state["messages"][-2])
    tool_message = cast(ToolMessage, state["messages"][-1])
    if tool_message.content == "YES":
        if ai_message.tool_calls:
            urls = ai_message.tool_calls[0]["args"]["urls"]
        else:
            parsed_tool_call = json.loads(ai_message.additional_kwargs["function_call"]["arguments"])
            urls = parsed_tool_call["urls"]

        state["resources"] = [
            resource for resource in state["resources"] if resource["url"] not in urls
        ]

    return state
