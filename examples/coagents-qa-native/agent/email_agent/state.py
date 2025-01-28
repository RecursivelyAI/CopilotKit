"""
This is the state definition for the AI.
It defines the state of the agent and the state of the conversation.
"""

from copilotkit import CopilotKitState

class EmailAgentState(CopilotKitState):
    """Email Agent State"""
    email: str
    model: str
    sender: str
