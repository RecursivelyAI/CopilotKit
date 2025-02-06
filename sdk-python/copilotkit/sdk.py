"""CopilotKit SDK"""

import warnings
from importlib import metadata

from pprint import pformat
from typing import List, Callable, Union, Optional, Any, Coroutine
from typing_extensions import TypedDict, Tuple, cast
from .agent import Agent, AgentDict
from .action import Action, ActionDict, ActionResultDict
from .types import Message, MetaEvent
from .exc import (
    ActionNotFoundException,
    AgentNotFoundException,
    ActionExecutionException,
    AgentExecutionException
)
from .logging import get_logger, bold


try:
    __version__ = metadata.version(cast(str, __package__))
except metadata.PackageNotFoundError:
    # Case where package metadata is not available.
    __version__ = ""
del metadata  # optional, avoids polluting the results of dir(__package__)

COPILOTKIT_SDK_VERSION = __version__

logger = get_logger(__name__)

class InfoDict(TypedDict):
    """
    Info dictionary
    """
    sdkVersion: str
    actions: List[ActionDict]
    agents: List[AgentDict]

class CopilotKitContext(TypedDict):
    """
    CopilotKit Context
    
    Parameters
    ----------
    properties : Any
        The properties provided to the frontend via `<CopilotKit properties={...} />`
    frontend_url : Optional[str]
        The current URL of the frontend
    """
    properties: Any
    frontend_url: Optional[str]

# Alias for backwards compatibility
CopilotKitSDKContext = CopilotKitContext


class CopilotKitRemoteEndpoint:
    """
    CopilotKitRemoteEndpoint lets you connect actions and agents written in Python to your 
    CopilotKit application.

    To install CopilotKit for Python, run:

    ```bash
    pip install copilotkit
    ```

    ## Adding actions

    In this example, we provide a simple action to the Copilot:

    ```python
    from copilotkit import CopilotKitRemoteEndpoint, Action

    sdk = CopilotKitRemoteEndpoint(
        actions=[
            Action(
                name="greet_user",
                handler=greet_user_handler,
                description="Greet the user",
                parameters=[
                    {
                        "name": "name",
                        "type": "string",
                        "description": "The name of the user"
                    }
                ]
            )
        ]
    )
    ```

    You can also dynamically build actions by providing a callable that returns a list of actions.
    In this example, we use "name" from the `properties` object to parameterize the action handler.

    ```python
    from copilotkit import CopilotKitRemoteEndpoint, Action

    sdk = CopilotKitRemoteEndpoint(
        actions=lambda context: [
            Action(
                name="greet_user",
                handler=make_greet_user_handler(context["properties"]["name"]), 
                description="Greet the user"
            )
        ]
    )
    ```

    Using the same approach, you can restrict the actions available to the Copilot:

    ```python
    from copilotkit import CopilotKitRemoteEndpoint, Action

    sdk = CopilotKitRemoteEndpoint(
        actions=lambda context: (
            [action_a, action_b] if is_admin(context["properties"]["token"]) else [action_a]
        )
    )
    ```

    ## Adding agents

    Serving agents works in a similar way to serving actions:

    ```python
    from copilotkit import CopilotKitRemoteEndpoint, LangGraphAgent
    from my_agent.agent import graph

    sdk = CopilotKitRemoteEndpoint(
        agents=[
            LangGraphAgent(
                name="email_agent",
                description="This agent sends emails",
                graph=graph,
            )
        ]
    )
    ```

    To dynamically build agents, provide a callable that returns a list of agents:

    ```python
    from copilotkit import CopilotKitRemoteEndpoint, LangGraphAgent
    from my_agent.agent import graph

    sdk = CopilotKitRemoteEndpoint(
        agents=lambda context: [
            LangGraphAgent(
                name="email_agent",
                description="This agent sends emails",
                graph=graph,
                langgraph_config={
                    "token": context["properties"]["token"]
                }
            )
        ]
    )
    ```

    To restrict the agents available to the Copilot, simply return a different list of agents based on the `context`:

    ```python
    from copilotkit import CopilotKitRemoteEndpoint
    from my_agents import agent_a, agent_b, is_admin

    sdk = CopilotKitRemoteEndpoint(
        agents=lambda context: (
            [agent_a, agent_b] if is_admin(context["properties"]["token"]) else [agent_a]
        )
    )
    ```

    ## Serving the CopilotKit SDK

    To serve the CopilotKit SDK, you can use the `add_fastapi_endpoint` function from the `copilotkit.integrations.fastapi` module:

    ```python
    from copilotkit.integrations.fastapi import add_fastapi_endpoint
    from fastapi import FastAPI

    app = FastAPI()
    sdk = CopilotKitRemoteEndpoint(...)
    add_fastapi_endpoint(app, sdk, "/copilotkit")

    def main():
        uvicorn.run(
            "your_package:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
        )

    ```

    Parameters
    ----------
    actions : Optional[Union[List[Action], Callable[[CopilotKitContext], List[Action]]]]
        The actions to make available to the Copilot.
    agents : Optional[Union[List[Agent], Callable[[CopilotKitContext], List[Agent]]]]
        The agents to make available to the Copilot.
    """

    def __init__(
        self,
        *,
        actions: Optional[
            Union[
                List[Action],
                Callable[[CopilotKitContext], List[Action]]
            ]
        ] = None,
        agents: Optional[
            Union[
                List[Agent],
                Callable[[CopilotKitContext], List[Agent]]
            ]
        ] = None,
    ):
        self.agents = agents or []
        self.actions = actions or []

    def info(
        self,
        *,
        context: CopilotKitContext
    ) -> InfoDict:
        """
        Returns information about available actions and agents
        """

        actions = self.actions(context) if callable(self.actions) else self.actions
        agents = self.agents(context) if callable(self.agents) else self.agents

        actions_list = [action.dict_repr() for action in actions]
        agents_list = [agent.dict_repr() for agent in agents]

        self._log_request_info(
            title="Handling info request:",
            data=[
                ("Context", context),
                ("Actions", actions_list),
                ("Agents", agents_list),
            ]
        )

        return {
            "actions": actions_list,
            "agents": agents_list,
            "sdkVersion": COPILOTKIT_SDK_VERSION
        }

    def _get_action(
        self,
        *,
        context: CopilotKitContext,
        name: str,
    ) -> Action:
        """
        Get an action by name
        """
        actions = self.actions(context) if callable(self.actions) else self.actions
        action = next((action for action in actions if action.name == name), None)
        if action is None:
            raise ActionNotFoundException(name)
        return action

    def execute_action(
            self,
            *,
            context: CopilotKitContext,
            name: str,
            arguments: dict,
    ) -> Coroutine[Any, Any, ActionResultDict]:
        """
        Execute an action
        """

        action = self._get_action(context=context, name=name)

        self._log_request_info(
            title="Handling execute action request:",
            data=[
                ("Context", context),
                ("Action", action.dict_repr()),
                ("Arguments", arguments),
            ]
        )

        try:
            result = action.execute(arguments=arguments)
            return result
        except Exception as error:
            raise ActionExecutionException(name, error) from error

    def execute_agent( # pylint: disable=too-many-arguments
        self,
        *,
        context: CopilotKitContext,
        name: str,
        thread_id: str,
        state: dict,
        messages: List[Message],
        actions: List[ActionDict],
        node_name: str,
        meta_events: Optional[List[MetaEvent]] = None,
    ) -> Any:
        """
        Execute an agent
        """
        agents = self.agents(context) if callable(self.agents) else self.agents
        agent = next((agent for agent in agents if agent.name == name), None)
        if agent is None:
            raise AgentNotFoundException(name)

        self._log_request_info(
            title="Handling execute agent request:",
            data=[
                ("Context", context),
                ("Agent", agent.dict_repr()),
                ("Thread ID", thread_id),
                ("Node Name", node_name),
                ("State", state),
                ("Messages", messages),
                ("Actions", actions),
                ("MetaEvents", meta_events),
            ]
        )

        try:
            return agent.execute(
                thread_id=thread_id,
                node_name=node_name,
                state=state,
                messages=messages,
                actions=actions,
                meta_events=meta_events
            )
        except Exception as error:
            raise AgentExecutionException(name, error) from error

    def get_agent_state(
        self,
        *,
        context: CopilotKitContext,
        thread_id: str,
        name: str,
    ):
        """
        Get agent state
        """
        agents = self.agents(context) if callable(self.agents) else self.agents
        agent = next((agent for agent in agents if agent.name == name), None)
        if agent is None:
            raise AgentNotFoundException(name)

        self._log_request_info(
            title="Handling get agent state request:",
            data=[
                ("Context", context),
                ("Agent", agent.dict_repr()),
                ("Thread ID", thread_id),
            ]
        )
        try:
            return agent.get_state(thread_id=thread_id)
        except Exception as error:
            raise AgentExecutionException(name, error) from error

    def _log_request_info(self, title: str, data: List[Tuple[str, Any]]):
        """
        Log request info
        """
        logger.info(bold(title))
        logger.info("--------------------------")
        for key, value in data:
            logger.info(bold(key+":"))
            logger.info(pformat(value))
        logger.info("--------------------------")

# Alias for backwards compatibility
class CopilotKitSDK(CopilotKitRemoteEndpoint):
    """Deprecated: Use CopilotKitRemoteEndpoint instead. This class will be removed in a future version."""

    def __init__(self, *args, **kwargs):
        warnings.warn(
            "CopilotKitSDK is deprecated since version 0.1.31. "
            "Use CopilotKitRemoteEndpoint instead.",
            DeprecationWarning,
            stacklevel=2
        )
        super().__init__(*args, **kwargs)
