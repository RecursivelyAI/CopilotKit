"""Test Q&A Agent"""

from typing import cast
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import HumanMessage, AIMessage
from copilotkit.langgraph import (
    copilotkit_exit,
    copilotkit_customize_config
)
from pydantic import BaseModel, Field
from greeting_agent.state import GreetAgentState
from greeting_agent.model import get_model

class ExtractNameTool(BaseModel):
    """
    Extract the user's name from the message.
    Make sure to only set the name if you are 100 percent sure it is the name of the user.
    """
    name: str = Field(..., description="The user's name or UNKNOWN if you can't find it")

async def ask_name_node(state: GreetAgentState, config: RunnableConfig): # pylint: disable=unused-argument
    """
    Ask the user for their name.
    """

    return {
        "messages": AIMessage(content="Hey, what is your name? 🙂"),
    }


async def extract_name_node(state: GreetAgentState, config: RunnableConfig):
    """
    Check if the user's name is in the message.
    """

    config = copilotkit_customize_config(config, emit_tool_calls=False)

    last_message = cast(HumanMessage, state["messages"][-1])

    instructions = (
        f"Figure out the user's name if possible from this response they gave you: {last_message.content}" # pylint: disable=line-too-long
    )

    model = get_model(state).bind_tools(
        [ExtractNameTool],
        tool_choice="ExtractNameTool"
    )

    response = await model.ainvoke([
        *state["messages"],
        HumanMessage(
            content=instructions
        )
    ], config)

    tool_calls = cast(AIMessage, response).tool_calls
    name = None

    if tool_calls is not None:
        if tool_calls[0]["args"]["name"] != "UNKNOWN":
            name = tool_calls[0]["args"]["name"]

    if name is None:
        return {
            "messages": state["messages"],
        }

    return {
        "name": name,
    }

async def greet_node(state: GreetAgentState, config: RunnableConfig):
    """
    Greet the user by name.
    """

    await copilotkit_exit(config)

    return {
        "messages": AIMessage(content="Hello, " + state["name"] + " 😎"),
    }

def route(state: GreetAgentState):
    """Route to the appropriate node."""

    if state.get("name", None) is not None:
        return "greet_node"
    return "ask_name_node"

workflow = StateGraph(GreetAgentState)

workflow.add_node("ask_name_node", ask_name_node)
workflow.add_node("greet_node", greet_node)
workflow.add_node("extract_name_node", extract_name_node)

workflow.set_entry_point("ask_name_node")

workflow.add_edge("ask_name_node", "extract_name_node")
workflow.add_conditional_edges("extract_name_node", route)
workflow.add_edge("greet_node", END)
memory = MemorySaver()
graph = workflow.compile(checkpointer=memory, interrupt_after=["ask_name_node"])
