"""
This is the main entry point for the AI.
It defines the workflow graph and the entry point for the agent.
"""

from typing_extensions import Literal
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, AIMessage
from langchain_core.runnables import RunnableConfig
from langchain.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command
from langgraph.prebuilt import ToolNode
from copilotkit import CopilotKitState

class AgentState(CopilotKitState):
    """Contains the state of the agent."""
    # your custom agent state here

@tool
def greet_user(name: str):
    """Say hello to the user."""
    print(f"Hello, {name}!")
    return "The user was greeted. YOU MUST TELL THE USER TO CHECK THE CONSOLE FOR THE RESULT."

# This tool node is responsible for executing tools defined in LangGraph
tool_node = ToolNode(tools=[greet_user])

async def frontend_tool_node(state: AgentState, config: RunnableConfig): # pylint: disable=unused-argument
    """Frontend tool node."""
    # To execute frontend actions in CopilotKit, we interrupt execution of the graph
    # (see interrupt_after below) and let CopilotKit handle the rest.

async def react_node(state: AgentState, config: RunnableConfig) \
    -> Command[Literal["frontend_tool_node", "tool_node", "__end__"]]:
    """CopilotKit ReAct Agent"""

    model = ChatOpenAI(model="gpt-4o").bind_tools(
        [*state["copilotkit"]["actions"], greet_user]
    )

    response = await model.ainvoke([
        SystemMessage(
            content="You are a helpful assistant."
        ),
        *state["messages"],
    ], config)

    if isinstance(response, AIMessage) and response.tool_calls:
        actions = state["copilotkit"]["actions"]

        for tool_call in response.tool_calls:
            # if there is any frontend action, go to the frontend tool node
            if any(action.get("name") == tool_call.get("name") for action in actions):
                return Command(
                    goto="frontend_tool_node",
                    update={
                        "messages": response
                    }
                )

        # run the LangGraph tool node
        return Command(
            goto="tool_node",
            update={
                "messages": response
            }
        )

    # if there are no tool calls, end the graph
    return Command(
        goto=END,
        update={
            "messages": response
        }
    )

workflow = StateGraph(AgentState)
workflow.add_node("react_node", react_node)
workflow.add_node("frontend_tool_node", frontend_tool_node)
workflow.add_node("tool_node", tool_node)
workflow.add_edge("tool_node", "react_node")
workflow.add_edge("frontend_tool_node", "react_node")
workflow.set_entry_point("react_node")

memory = MemorySaver()
graph = workflow.compile(
    checkpointer=memory,
    interrupt_after=["frontend_tool_node"]
)
