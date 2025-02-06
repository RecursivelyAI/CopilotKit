"""
Delete Resources
"""

import json
from typing_extensions import Dict, Any

def maybe_perform_delete(state: Dict[str, Any]):
    """
    Maybe perform delete.
    """
    messages = state["messages"]
    if len(messages) >= 2:
        last_message = messages[-1]
        prev_message = messages[-2]
        if (prev_message.get("tool_calls") and
            prev_message["tool_calls"][0]["function"].get("name") == "DeleteResources" and
            last_message.get("content") == "YES"):
            urls = json.loads(prev_message["tool_calls"][0]["function"]["arguments"])["urls"]
            state["resources"] = [
                resource for resource in state["resources"] if resource["url"] not in urls
            ]
