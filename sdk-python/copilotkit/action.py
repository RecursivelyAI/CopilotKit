"""Actions"""

import re
from inspect import iscoroutinefunction
from typing import Optional, List, Callable, TypedDict, Any, cast
from .parameter import Parameter, normalize_parameters

class ActionDict(TypedDict):
    """Dict representation of an action"""
    name: str
    description: str
    parameters: List[Parameter]

class ActionResultDict(TypedDict):
    """Dict representation of an action result"""
    result: Any

class Action:  # pylint: disable=too-few-public-methods
    """Action class for CopilotKit"""
    def __init__(
            self,
            *,
            name: str,
            handler: Callable,
            description: Optional[str] = None,
            parameters: Optional[List[Parameter]] = None,
        ):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.handler = handler

        if not re.match(r"^[a-zA-Z0-9_-]+$", name):
            raise ValueError(
                f"Invalid action name '{name}': " +
                "must consist of alphanumeric characters, underscores, and hyphens only"
            )

    async def execute(
            self,
            *,
            arguments: dict
        ) -> ActionResultDict:
        """Execute the action"""
        result = self.handler(**arguments)

        return {
            "result": await result if iscoroutinefunction(self.handler) else result
        }

    def dict_repr(self) -> ActionDict:
        """Dict representation of the action"""
        return {
            'name': self.name,
            'description': self.description or '',
            'parameters': normalize_parameters(cast(Any, self.parameters)),
        }
