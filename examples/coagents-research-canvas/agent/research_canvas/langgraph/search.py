"""
The search node is responsible for searching the internet for information.
"""

import os
from typing import cast, List
from pydantic import BaseModel, Field
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import AIMessage, ToolMessage, SystemMessage
from langchain.tools import tool
from tavily import TavilyClient
from copilotkit.langgraph import copilotkit_emit_state, copilotkit_customize_config
from research_canvas.langgraph.state import AgentState
from research_canvas.langgraph.model import get_model

class ResourceInput(BaseModel):
    """A resource with a short description"""
    url: str = Field(description="The URL of the resource")
    title: str = Field(description="The title of the resource")
    description: str = Field(description="A short description of the resource")

@tool
def ExtractResources(resources: List[ResourceInput]): # pylint: disable=invalid-name,unused-argument
    """Extract the 3-5 most relevant resources from a search result."""

tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

async def search_node(state: AgentState, config: RunnableConfig):
    """
    The search node is responsible for searching the internet for resources.
    """

    ai_message = cast(AIMessage, state["messages"][-1])

    state["resources"] = state.get("resources", [])
    state["logs"] = state.get("logs", [])
    queries = ai_message.tool_calls[0]["args"]["queries"]

    for query in queries:
        state["logs"].append({
            "message": f"Search for {query}",
            "done": False
        })

    await copilotkit_emit_state(config, state)

    search_results = []

    for i, query in enumerate(queries):
        response = tavily_client.search(query)
        search_results.append(response)
        state["logs"][i]["done"] = True
        await copilotkit_emit_state(config, state)

    config = copilotkit_customize_config(
        config,
        emit_intermediate_state=[{
            "state_key": "resources",
            "tool": "ExtractResources",
            "tool_argument": "resources",
        }],
    )

    model = get_model(state)
    ainvoke_kwargs = {}
    if model.__class__.__name__ in ["ChatOpenAI"]:
        ainvoke_kwargs["parallel_tool_calls"] = False

    # figure out which resources to use
    response = await model.bind_tools(
        [ExtractResources],
        tool_choice="ExtractResources",
        **ainvoke_kwargs
    ).ainvoke([
        SystemMessage(
            content="""
            You need to extract the 3-5 most relevant resources from the following search results.
            """
        ),
        *state["messages"],
        ToolMessage(
        tool_call_id=ai_message.tool_calls[0]["id"],
        content=f"Performed search: {search_results}"
    )
    ], config)

    state["logs"] = []
    await copilotkit_emit_state(config, state)

    ai_message_response = cast(AIMessage, response)
    resources = ai_message_response.tool_calls[0]["args"]["resources"]

    state["resources"].extend(resources)

    state["messages"].append(ToolMessage(
        tool_call_id=ai_message.tool_calls[0]["id"],
        content=f"Added the following resources: {resources}"
    ))

    return state
