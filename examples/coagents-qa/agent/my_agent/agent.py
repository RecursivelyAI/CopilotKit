"""Test Human in the Loop Agent"""

import os
from typing import Any, cast
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langgraph.graph import StateGraph, END
from langgraph.graph import MessagesState
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import HumanMessage, ToolMessage, AIMessage
from copilotkit.langgraph import (
    copilotkit_exit,
    copilotkit_emit_message
)
from pydantic import BaseModel, Field


def get_model():
    """
    Get a model based on the environment variable.
    """
    model = os.getenv("MODEL", "openai")

    if model == "openai":
        return ChatOpenAI(temperature=0, model="gpt-4o")
    if model == "anthropic":
        return ChatAnthropic(
            temperature=0,
            model_name="claude-3-5-sonnet-20240620",
            timeout=None,
            stop=None
        )

    raise ValueError("Invalid model specified")


class EmailAgentState(MessagesState):
    """Email Agent State"""
    email: str

class EmailTool(BaseModel):
    """
    Write an email.
    """
    email_draft: str = Field(description="The draft of the email to be written.")


async def draft_email_node(state: EmailAgentState, config: RunnableConfig):
    """
    Write an email.
    """

    instructions = "You write emails."

    email_model = get_model().bind_tools(
        [EmailTool],
        tool_choice="EmailTool"
    )

    response = await email_model.ainvoke([
        *state["messages"],
        HumanMessage(
            content=instructions
        )
    ], config)

    tool_calls = cast(Any, response).tool_calls

    # the email content is the argument passed to the email tool
    email = tool_calls[0]["args"]["email_draft"]

    return {
        "messages": response,
        "email": email,
    }

async def send_email_node(state: EmailAgentState, config: RunnableConfig):
    """
    Send an email.
    """

    await copilotkit_exit(config)

    # get the last message and cast to ToolMessage
    last_message = cast(ToolMessage, state["messages"][-1])
    message_to_add = ""
    if last_message.content == "CANCEL":
        message_to_add = "❌ Cancelled sending email."
    else:
        message_to_add = "✅ Sent email."

    await copilotkit_emit_message(config, message_to_add)
    return {
        "messages": state["messages"] + [AIMessage(content=message_to_add)],
    }


workflow = StateGraph(EmailAgentState)
workflow.add_node("draft_email_node", draft_email_node)
workflow.add_node("send_email_node", send_email_node)
workflow.set_entry_point("draft_email_node")

workflow.add_edge("draft_email_node", "send_email_node")
workflow.add_edge("send_email_node", END)
memory = MemorySaver()
graph = workflow.compile(checkpointer=memory, interrupt_after=["draft_email_node"])
