"""
The search node is responsible for searching the internet for information.
"""

import os
import json
import googlemaps
from typing import cast
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import AIMessage, ToolMessage
from langchain.tools import tool
from copilotkit.langgraph import copilotkit_emit_state, copilotkit_customize_config
from travel.state import AgentState

@tool
def search_for_places(queries: list[str]) -> list[dict]:
    """Search for places based on a query, returns a list of places including their name, address, and coordinates."""

gmaps = googlemaps.Client(key=os.getenv("GOOGLE_MAPS_API_KEY"))

async def search_node(state: AgentState, config: RunnableConfig):
    """
    The search node is responsible for searching the for places.
    """
    ai_message = cast(AIMessage, state["messages"][-1])

    config = copilotkit_customize_config(
        config,
        emit_intermediate_state=[{
            "state_key": "search_progress",
            "tool": "search_for_places",
            "tool_argument": "search_progress",
        }],
    )

    state["search_progress"] = state.get("search_progress", [])
    queries = ai_message.tool_calls[0]["args"]["queries"]

    for query in queries:
        state["search_progress"].append({
            "query": query,
            "results": [],
            "done": False
        })

    await copilotkit_emit_state(config, state)

    places = []
    for i, query in enumerate(queries):
        response = gmaps.places(query)
        for result in response.get("results", []):
            place = {
                "id": result.get("place_id", f"{result.get('name', '')}-{i}"),
                "name": result.get("name", ""),
                "address": result.get("formatted_address", ""),
                "latitude": result.get("geometry", {}).get("location", {}).get("lat", 0),
                "longitude": result.get("geometry", {}).get("location", {}).get("lng", 0),
                "rating": result.get("rating", 0),
            }
            places.append(place)
        state["search_progress"][i]["done"] = True
        await copilotkit_emit_state(config, state)

    state["search_progress"] = []
    await copilotkit_emit_state(config, state)

    state["messages"].append(ToolMessage(
        tool_call_id=ai_message.tool_calls[0]["id"],
        content=f"Added the following search results: {json.dumps(places)}"
    ))

    return state
