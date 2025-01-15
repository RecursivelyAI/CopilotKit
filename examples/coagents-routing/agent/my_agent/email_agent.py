"""Email Agent"""

from typing import Any, cast
from langgraph.graph import StateGraph, END
from langgraph.graph import MessagesState
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import SystemMessage, ToolMessage
from copilotkit.langgraph import copilotkit_customize_config, copilotkit_exit
from pydantic import BaseModel, Field
from my_agent.model import get_model


class EmailAgentState(MessagesState):
    """Email Agent State"""
    email: str
    model: str


class write_email(BaseModel): # pylint: disable=invalid-name
    """
    Write an email.
    """
    the_email: str = Field(..., description="The email")


async def email_node(state: EmailAgentState, config: RunnableConfig):
    """
    Make a joke.
    """

    config = copilotkit_customize_config(
        config,
        emit_messages=True,
        emit_intermediate_state=[
            {
                "state_key": "email",
                "tool": "write_email",
                "tool_argument": "the_email"
            },
        ]
    )

    system_message = "You write emails."

    email_model = get_model(state).bind_tools(
        [write_email],
        tool_choice="write_email"
    )

    response = await email_model.ainvoke([
        SystemMessage(
            content=system_message
        ),
        *state["messages"]
    ], config)

    tool_calls = getattr(response, "tool_calls")

    email = tool_calls[0]["args"]["the_email"]

    await copilotkit_exit(config)

    return {
        "messages": [
            response,
            ToolMessage(
                name=tool_calls[0]["name"],
                content=email,
                tool_call_id=tool_calls[0]["id"]
            )
        ],
        "email": email,
    }

workflow = StateGraph(EmailAgentState)
workflow.add_node("email_node", cast(Any, email_node))
workflow.set_entry_point("email_node")

workflow.add_edge("email_node", END)
memory = MemorySaver()
email_graph = workflow.compile(checkpointer=memory)
