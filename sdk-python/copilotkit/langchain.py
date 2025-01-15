"""
copilotkit.langchain is deprecated. Use copilotkit.langgraph instead.
"""
import warnings
from copilotkit.langgraph import (
  langchain_messages_to_copilotkit,
  copilotkit_messages_to_langchain,
  copilotkit_customize_config,
  copilotkit_exit,
  copilotkit_emit_state,
  copilotkit_emit_message,
  copilotkit_emit_tool_call,

)

warnings.warn(
    "copilotkit.langchain is deprecated. Use copilotkit.langgraph instead.",
    DeprecationWarning,
    stacklevel=2
)

__all__ = [
  "langchain_messages_to_copilotkit",
  "copilotkit_messages_to_langchain",
  "copilotkit_customize_config",
  "copilotkit_exit",
  "copilotkit_emit_state",
  "copilotkit_emit_message",
  "copilotkit_emit_tool_call",
]
