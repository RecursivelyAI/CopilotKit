from typing import cast, List
from langchain_core.messages import ToolMessage, AIMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from travel.state import AgentState, Trip, Place
from copilotkit.langgraph import copilotkit_emit_message



async def trips_node(state: AgentState, config: RunnableConfig): # pylint: disable=unused-argument
    """
    Lets the user know about the operations about to be performed on trips.
    """
    return state

async def perform_trips_node(state: AgentState, config: RunnableConfig):
    """Execute trip operations"""
    ai_message = cast(AIMessage, state["messages"][-2])
    tool_message = cast(ToolMessage, state["messages"][-1])
    
    if tool_message.content == "CANCEL":
        return state
    
    if not isinstance(ai_message, AIMessage) or not ai_message.tool_calls:
        return state

    action_handlers = {
        "add_trips": lambda args: handle_add_trips(state, args),
        "delete_trips": lambda args: handle_delete_trips(state, args),
        "update_trips": lambda args: handle_update_trips(state, args),
    }

    # Initialize the trips list if it doesn't exist
    if not state.get("trips"):
        state["trips"] = []

    new_messages = []

    for tool_call in ai_message.tool_calls:
        action = tool_call["name"]
        args = tool_call.get("args", {})
        
        if action in action_handlers:
            message = action_handlers[action](args)
            new_messages.append(message)
            await copilotkit_emit_message(config, message)

    return {
        "messages": [AIMessage(content=msg) for msg in new_messages],
    }

@tool
def add_trips(trips: List[Trip]):
    """Add one or many trips to the list"""

def handle_add_trips(state: AgentState, args: dict) -> str:
    trips = args.get("trips", [])

    state["trips"].extend(trips)
    return f"Added {len(trips)} trips!"

@tool
def delete_trips(trip_ids: List[str]):
    """Delete one or many trips. YOU MUST NOT CALL this tool multiple times in a row!"""

def handle_delete_trips(state: AgentState, args: dict) -> str:
    trip_ids = args.get("trip_ids", [])
    
    # Clear selected_trip if it's being deleted
    if state.get("selected_trip_id") and state["selected_trip_id"] in trip_ids:
        state["selected_trip_id"] = None

    state["trips"] = [trip for trip in state["trips"] if trip["id"] not in trip_ids]
    return f"Deleted {len(trip_ids)} trips!"

@tool
def update_trips(trips: List[Trip]):
    """Update one or many trips"""

def handle_update_trips(state: AgentState, args: dict) -> str:
    trips = args.get("trips", [])
    for trip in trips:
        state["trips"] = [
            {**existing_trip, **trip} if existing_trip["id"] == trip["id"] else existing_trip
            for existing_trip in state["trips"]
        ]
    return f"Updated {len(trips)} trips!"
