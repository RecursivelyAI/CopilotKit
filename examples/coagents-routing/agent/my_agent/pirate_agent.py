"""Test Pirate Agent"""

from typing import Any, cast
from langgraph.graph import StateGraph, END
from langgraph.graph import MessagesState
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import SystemMessage
from copilotkit.langgraph import copilotkit_exit
from my_agent.model import get_model


class PirateAgentState(MessagesState):
    """Pirate Agent State"""
    model: str

async def pirate_node(state: PirateAgentState, config: RunnableConfig): # pylint: disable=unused-argument
    """
    Speaks like a pirate
    """

    system_message = "You speak like a pirate. Your name is Captain Copilot. " + \
        "If the user wants to stop talking, you will say (literally) " + \
        "'Arrr, I'll be here if you need me!'"

    pirate_model = get_model(state)

    response = await pirate_model.ainvoke([
        SystemMessage(
            content=system_message
        ),
        *state["messages"],        
    ], config)

    if response.content == "Arrr, I'll be here if you need me!":
        await copilotkit_exit(config)

    return {
        "messages": response,
    }

workflow = StateGraph(PirateAgentState)
workflow.add_node("pirate_node", cast(Any, pirate_node))
workflow.set_entry_point("pirate_node")
workflow.add_edge("pirate_node", END)
memory = MemorySaver()
pirate_graph = workflow.compile(checkpointer=memory)
