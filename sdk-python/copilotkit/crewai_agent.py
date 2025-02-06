"""
CrewAI Agent
"""

import uuid
import json
import queue
import threading
import asyncio
import traceback
from copy import deepcopy
from typing import Optional, List, Callable
from typing_extensions import TypedDict, NotRequired, Any, Dict, cast
from crewai import Crew, Flow
from crewai.flow import start
from crewai.cli.crew_chat import (
  initialize_chat_llm as crew_chat_initialize_chat_llm,
  generate_crew_chat_inputs as crew_chat_generate_crew_chat_inputs,
  generate_crew_tool_schema as crew_chat_generate_crew_tool_schema,
  build_system_message as crew_chat_build_system_message,
  create_tool_function as crew_chat_create_tool_function
)
from litellm import completion
from partialjson.json_parser import JSONParser as PartialJSONParser
from .agent import Agent
from .types import Message
from .action import ActionDict
from .protocol import (
  emit_runtime_events,
  text_message_start,
  text_message_content,
  text_message_end,
  action_execution_start,
  action_execution_args,
  action_execution_end,
  agent_state_message,
  AgentStateMessage
)
from .crewai import (
  copilotkit_messages_to_crewai_flow,
  CopilotKitCrewAIFlowEventType,
  crewai_flow_messages_to_copilotkit,
  _crewai_flow_thread_runner,
  copilotkit_stream,
  copilotkit_exit
)

class CopilotKitConfig(TypedDict):
    """
    CopilotKit config for CrewAIAgent

    This is used for advanced cases where you want to customize how CopilotKit interacts with
    CrewAI.

    ```python
    # Function signatures:
    def merge_state(
        *,
        state: dict,
        messages: List[BaseMessage],
        actions: List[Any],
        agent_name: str
    ):
        # ...implementation...

    ```

    Parameters
    ----------
    merge_state : Callable
        This function lets you customize how CopilotKit merges the agent state.
    """
    merge_state: NotRequired[Callable]

class CrewAIFlowExecutionState(TypedDict):
    """
    State for an execution of a CrewAI Flow agent
    """
    should_exit: bool
    node_name: str
    is_finished: bool
    predict_state_configuration: Dict[str, Any]
    predicted_state: Dict[str, Any]
    argument_buffer: str
    current_tool_call: Optional[str]

class CrewAIAgent(Agent):
    """
    CrewAIAgent lets you define your agent for use with CopilotKit.

    To install, run:

    ```bash
    pip install copilotkit
    ```

    Every agent must have the `name` and either `crew` or `flow` properties defined. An optional 
    `description` can also be provided. This is used when CopilotKit is dynamically routing requests 
    to the agent.

    ## Serving a Crew based agent

    To serve a Crew based agent, pass in a `Crew` object to the `crew` parameter.

    Note:
    You need to make sure to have a `chat_llm` set on the `Crew` object.
    See [the CrewAI docs](https://docs.crewai.com/concepts/cli#9-chat) for more information.

    ```python
    from copilotkit import CrewAIAgent


    CrewAIAgent(
        name="email_agent_crew",
        description="This crew based agent sends emails",
        crew=SendEmailCrew(),
    )
    ```

    ## Serving a Flow based agent

    To serve a Flow based agent, pass in a `Flow` object to the `flow` parameter.

    ```python
    CrewAIAgent(
        name="email_agent_flow",
        description="This flow based agent sends emails",
        flow=SendEmailFlow(),
    )
    ```

    Note:
    Either a `crew` or `flow` must be provided to CrewAIAgent.

    Parameters
    ----------
    name : str
        The name of the agent.
    crew : Crew
        When using a Crew based agent, pass in a `Crew` object to the `crew` parameter.
    flow : Flow
        When using a Flow based agent, pass in a `Flow` object to the `flow` parameter.
    description : Optional[str]
        The description of the agent.
    copilotkit_config : Optional[CopilotKitConfig]
        The CopilotKit config to use with the agent.

    """
    def __init__(
            self,
            *,
            name: str,
            description: Optional[str] = None,
            crew: Optional[Crew] = None,
            flow: Optional[Flow] = None,
            copilotkit_config: Optional[CopilotKitConfig] = None,
        ):
        super().__init__(
            name=name,
            description=description,
        )
        if (crew is None) == (flow is None):
            raise ValueError("Either crew or flow must be provided to CrewAIAgent")


        self.crew = crew
        self.flow = flow
        self.copilotkit_config = copilotkit_config or {}

    def execute( # pylint: disable=too-many-arguments
        self,
        *,
        state: dict,
        messages: List[Message],
        thread_id: Optional[str] = None,
        actions: Optional[List[ActionDict]] = None,
        **kwargs,
    ):
        """Execute the agent"""
        if self.crew:
            crew = deepcopy(self.crew)
            return self.execute_crew(
                state=state,
                messages=messages,
                thread_id=thread_id,
                actions=actions,
                crew=crew,
                **kwargs
            )

        flow = deepcopy(self.flow)
        return self.execute_flow(
            state=state,
            messages=messages,
            thread_id=thread_id,
            actions=actions,
            flow=flow,
            **kwargs
        )

    def execute_crew( # pylint: disable=too-many-arguments,unused-argument
        self,
        *,
        state: dict,
        messages: List[Message],
        thread_id: Optional[str] = None,
        actions: Optional[List[ActionDict]] = None,
        crew: Optional[Crew] = None,
        **kwargs,
    ):
        """Execute a `Crew` based agent"""                

        flow = ChatWithCrewFlow(crew=crew, crew_name=self.name, thread_id=thread_id)

        return self.execute_flow(
            state=state,
            messages=messages,
            thread_id=thread_id,
            actions=actions,
            flow=flow,
            **kwargs
        )


    async def execute_flow( # pylint: disable=too-many-arguments,unused-argument,too-many-locals
        self,
        *,
        state: dict,
        messages: List[Message],
        thread_id: Optional[str] = None,
        actions: Optional[List[ActionDict]] = None,
        flow: Flow,
        **kwargs,
    ):
        """Execute a `Flow` based agent"""

        if thread_id is None:
            raise ValueError("Thread ID is required")

        run_id = str(uuid.uuid4())
        execution_state: CrewAIFlowExecutionState = {
            "should_exit": False,
            "node_name": "start",
            "is_finished": False,
            "predict_state_configuration": {},
            "predicted_state": {},
            "argument_buffer": "",
            "current_tool_call": None
        }

        merge_state = self.copilotkit_config.get("merge_state", crewai_flow_default_merge_state)

        crewai_flow_messages = copilotkit_messages_to_crewai_flow(messages)

        state = merge_state(
            state=state,
            messages=crewai_flow_messages,
            actions=actions or [],
            agent_name=self.name,
            flow=flow
        )


        # Create a local queue to receive events
        local_queue = queue.Queue()

        t = threading.Thread(
            target=_crewai_flow_thread_runner,
            args=(flow, local_queue, deepcopy(state)),
            daemon=False
        )
        t.start()

        while True:
            event_data = local_queue.get()
            local_queue.task_done()

            json_lines = handle_crewai_flow_event(
                event_data=event_data,
                thread_id=thread_id,
                agent_name=self.name,
                state=flow.state,
                run_id=run_id,
                execution_state=execution_state
            )

            if json_lines is not None:
                yield json_lines

            if execution_state["is_finished"]:
                break

            # return control to the containing run loop to send events
            loop = asyncio.get_running_loop()
            future = loop.create_future()
            loop.call_soon(future.set_result, None)
            await future

        t.join()

        state = {**flow.state}
        if "messages" in state:
            state["messages"] = crewai_flow_messages_to_copilotkit(state["messages"])

        # emit the final state
        yield emit_runtime_events(
            agent_state_message(
                thread_id=thread_id,
                agent_name=self.name,
                node_name=execution_state["node_name"],
                run_id=run_id,
                active=False,
                role="assistant",
                state=json.dumps(filter_state(state, exclude_keys=["id"])),
                running=not execution_state["should_exit"]
            )
        )



    def dict_repr(self):
        super_repr = super().dict_repr()
        return {
            **super_repr,
            'type': 'crewai'
        }

def crewai_flow_default_merge_state( # pylint: disable=unused-argument, too-many-arguments
        *,
        state: dict,
        flow: Flow,
        messages: List[Any],
        actions: List[Any],
        agent_name: str,
    ):
    """Default merge state for CrewAI"""
    if len(messages) > 0:
        if "role" in messages[0] and messages[0]["role"] == "system":
            messages = messages[1:]


    actions = [{
        "type": "function",
        "function": {
            **action,
        }
    } for action in actions]

    new_state = {
        **state,
        "messages": messages,
        "copilotkit": {
            "actions": actions
        }
    }

    return new_state

    # NOT SURE IF THIS IS NEEDED, COMMENTING IT FOR NOW
    # ensure to only merge supported keys
    # supported_keys = []


    # if flow.initial_state is None and hasattr(flow, "_initial_state_T"):
    #     state_type = getattr(flow, "_initial_state_T")
    #     if isinstance(state_type, type):
    #         if state_type is dict:
    #             # all keys are supported, return as is
    #             return new_state

    #         supported_keys = [
    #             attr for attr in dir(state_type)
    #             if not callable(getattr(state_type, attr))
    #             and not attr.startswith("__")
    #         ]
    #     else:
    #         return new_state
    # elif flow.initial_state is None:
    #     # no initial state, return as is
    #     return new_state
    # else:
    #     if isinstance(flow.initial_state, dict):
    #         # all keys are supported, return as is
    #         return new_state

    #     supported_keys = [
    #         attr for attr in dir(flow.initial_state)
    #         if not callable(getattr(flow.initial_state, attr))
    #         and not attr.startswith("__")
    #     ]

    # # remove all unsupported keys
    # for key in list(new_state.keys()):
    #     if key not in supported_keys:
    #         del new_state[key]

    # return new_state

def filter_state(state: Dict[str, Any], exclude_keys: Optional[List[str]] = None) -> Dict[str, Any]:
    """Filter out messages and id from the state"""
    exclude_keys = exclude_keys or ["messages", "id"]
    return {k: v for k, v in state.items() if k not in exclude_keys}

def handle_crewai_flow_event(
        *,
        event_data: Any,
        thread_id: str,
        agent_name: str,
        state: Any,
        run_id: str,
        execution_state: CrewAIFlowExecutionState
    ) -> Optional[str]: # pylint: disable=too-many-return-statements, too-many-arguments
    """Handle a CrewAI flow event"""
    if event_data["type"] == CopilotKitCrewAIFlowEventType.EMIT_MESSAGE:
        return emit_runtime_events(
            text_message_start(message_id=event_data["message_id"]),
            text_message_content(
                message_id=event_data["message_id"],
                content=event_data["message"]
            ),
            text_message_end(message_id=event_data["message_id"])
        )
    if event_data["type"] == CopilotKitCrewAIFlowEventType.EMIT_TOOL_CALL:
        return emit_runtime_events(
            action_execution_start(
                action_execution_id=event_data["message_id"],
                action_name=event_data["name"]
            ),
            action_execution_args(
                action_execution_id=event_data["message_id"],
                args=json.dumps(event_data["args"])
            ),
            action_execution_end(action_execution_id=event_data["message_id"])
        )
    if event_data["type"] == CopilotKitCrewAIFlowEventType.EMIT_STATE:
        state = {k: v for k, v in state.items() if k != "messages"}

        return emit_runtime_events(
            agent_state_message(
                thread_id=thread_id,
                agent_name=agent_name,
                node_name=execution_state["node_name"],
                run_id=run_id,
                active=True,
                role="assistant",
                state=json.dumps(filter_state(event_data["state"])),
                running=True
            )
        )
    if event_data["type"] == CopilotKitCrewAIFlowEventType.EXIT:
        execution_state["should_exit"] = True
        return None

    if event_data["type"] == CopilotKitCrewAIFlowEventType.PREDICT_STATE:
        execution_state["predict_state_configuration"] = event_data["config"]
        return None

        # Later we will us this to let the frontend handle predicting state
        # return emit_runtime_events(
        #     meta_event(
        #         name=RuntimeMetaEventName.PREDICT_STATE_EVENT,
        #         value={
        #             "key": event_data["key"],
        #             "tool_name": event_data["tool_name"],
        #             "tool_argument": event_data.get("tool_argument", None)
        #         }
        #     )
        # )
    if event_data["type"] == CopilotKitCrewAIFlowEventType.METHOD_EXECUTION_STARTED:
        execution_state["node_name"] = event_data["name"]
        state = {k: v for k, v in state.items() if k != "messages"}

        return emit_runtime_events(
            agent_state_message(
                thread_id=thread_id,
                agent_name=agent_name,
                node_name=execution_state["node_name"],
                run_id=run_id,
                active=True,
                role="assistant",
                state=json.dumps(filter_state(state)),
                running=True
            )
        )
    if event_data["type"] == CopilotKitCrewAIFlowEventType.METHOD_EXECUTION_FINISHED:

        # reset the predict state configuration at the end of the method execution
        execution_state["predict_state_configuration"] = {}
        execution_state["current_tool_call"] = None
        execution_state["argument_buffer"] = ""
        execution_state["predicted_state"] = {}

        state = {k: v for k, v in state.items() if k != "messages"}

        return emit_runtime_events(
            agent_state_message(
                thread_id=thread_id,
                agent_name=agent_name,
                node_name=execution_state["node_name"],
                run_id=run_id,
                active=False,
                role="assistant",
                state=json.dumps(filter_state(state)),
                running=True
            )
        )

    if event_data["type"] == CopilotKitCrewAIFlowEventType.FLOW_EXECUTION_STARTED:
        # ignore this event
        return None

    if event_data["type"] == CopilotKitCrewAIFlowEventType.FLOW_EXECUTION_FINISHED:
        execution_state["is_finished"] = True
        return None

    if event_data["type"] == CopilotKitCrewAIFlowEventType.FLOW_EXECUTION_ERROR:
        print("Flow execution error", flush=True)

        # Check if event_data["error"] is a string or an exception object
        error_info = event_data["error"]

        if isinstance(error_info, Exception):
            # If it's an exception, print the traceback
            print("Exception occurred:", flush=True)
            print(''.join(traceback.format_exception(None, error_info, error_info.__traceback__)), flush=True)
        else:
            # Otherwise, assume it's a string and print it
            print(error_info, flush=True)

        execution_state["is_finished"] = True
        return None
    
    if event_data["type"] == CopilotKitCrewAIFlowEventType.TEXT_MESSAGE_START:
        return emit_runtime_events(
            text_message_start(
                message_id=event_data["message_id"],
                parent_message_id=event_data.get("parent_message_id", None)
            )
        )
    
    if event_data["type"] == CopilotKitCrewAIFlowEventType.TEXT_MESSAGE_CONTENT:
        return emit_runtime_events(
            text_message_content(
                message_id=event_data["message_id"],
                content=event_data["content"]
            )
        )
    
    if event_data["type"] == CopilotKitCrewAIFlowEventType.TEXT_MESSAGE_END:
        return emit_runtime_events(
            text_message_end(message_id=event_data["message_id"])
        )

    if event_data["type"] == CopilotKitCrewAIFlowEventType.ACTION_EXECUTION_START:
        events: List[Any] = [
            action_execution_start(
                action_execution_id=event_data["action_execution_id"],
                action_name=event_data["action_name"],
                parent_message_id=event_data.get("parent_message_id", None)
            )
        ]
        predicted_state_message = predict_state(
            thread_id=thread_id,
            agent_name=agent_name,
            run_id=run_id,
            event_data=event_data,
            execution_state=execution_state,
            state=state
        )
        if predicted_state_message is not None:
            events.append(predicted_state_message)
        return emit_runtime_events(*events)

    if event_data["type"] == CopilotKitCrewAIFlowEventType.ACTION_EXECUTION_ARGS:
        events: List[Any] = [
            action_execution_args(
                action_execution_id=event_data["action_execution_id"],
                args=event_data["args"]
            )
        ]
        predicted_state_message = predict_state(
            thread_id=thread_id,
            agent_name=agent_name,
            run_id=run_id,
            event_data=event_data,
            execution_state=execution_state,
            state=state
        )
        if predicted_state_message is not None:
            events.append(predicted_state_message)

        return emit_runtime_events(*events)

    if event_data["type"] == CopilotKitCrewAIFlowEventType.ACTION_EXECUTION_END:
        return emit_runtime_events(
            action_execution_end(action_execution_id=event_data["action_execution_id"])
        )

    raise ValueError(f"Unknown event type: {event_data['type']}")


def predict_state(
        *,
        thread_id: str,
        agent_name: str,
        run_id: str,
        event_data: Any,
        execution_state: CrewAIFlowExecutionState,
        state: Dict[str, Any]
) -> Optional[AgentStateMessage]:
    """Predict the state"""
    
    if event_data["type"] == CopilotKitCrewAIFlowEventType.ACTION_EXECUTION_START:
        execution_state["current_tool_call"] = event_data["action_name"]
        execution_state["argument_buffer"] = ""
    elif event_data["type"] == CopilotKitCrewAIFlowEventType.ACTION_EXECUTION_ARGS:
        execution_state["argument_buffer"] += event_data["args"]

        tool_names = [
            config.get("tool_name")
            for config in execution_state["predict_state_configuration"].values()
        ]

        if execution_state["current_tool_call"] not in tool_names:
            return None

        current_arguments = {}
        try:
            current_arguments = PartialJSONParser().parse(execution_state["argument_buffer"])
        except:  # pylint: disable=bare-except
            return None

        emit_update = False
        for k, v in execution_state["predict_state_configuration"].items():
            if v["tool_name"] == execution_state["current_tool_call"]:
                tool_argument = v.get("tool_argument")
                if tool_argument is not None:
                    argument_value = current_arguments.get(tool_argument)
                    if argument_value is not None:
                        execution_state["predicted_state"][k] = argument_value
                        emit_update = True
                else:
                    execution_state["predicted_state"][k] = current_arguments
                    emit_update = True

        if emit_update:
            return agent_state_message(
                thread_id=thread_id,
                agent_name=agent_name,
                node_name=execution_state["node_name"],
                run_id=run_id,
                active=True,
                role="assistant",
                state=json.dumps(filter_state({**state, **execution_state["predicted_state"]})),
                running=True
            )

        return None

CREW_EXIT_TOOL = {
    "type": "function",
    "function": {
        "name": "crew_exit",
        "description": "Call this when the user has indicated that they are done with the crew",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
}


class ChatWithCrewFlow(Flow):
    """Chat with crew"""

    def __init__(self, *, crew: Crew, crew_name: str, thread_id: str):
        super().__init__()
        self.crew = crew.crew()

        if self.crew.chat_llm is None:
            raise ValueError("Crew chat LLM is not set")

        self.crew_name = crew_name
        self.thread_id = thread_id
        self.chat_llm = crew_chat_initialize_chat_llm(self.crew)
        self.crew_chat_inputs = crew_chat_generate_crew_chat_inputs(self.crew, self.crew_name, self.chat_llm)
        self.crew_tool_schema = crew_chat_generate_crew_tool_schema(self.crew_chat_inputs)
        self.system_message = crew_chat_build_system_message(self.crew_chat_inputs)

        super().__init__()

    @start()
    async def chat(self):
        """Chat with the crew"""
        messages = [
            {
                "role": "system",
                "content": self.system_message,
                "id": self.thread_id + "-system"
            },
            *self.state["messages"]
        ]

        tools = [action for action in self.state["copilotkit"]["actions"]
                 if action["function"]["name"] != self.crew_name]

        tools += [self.crew_tool_schema, CREW_EXIT_TOOL]

        response = copilotkit_stream(
            completion(
                model=self.crew.chat_llm,
                messages=messages,
                tools=tools,
                parallel_tool_calls=False,
                stream=True
            )
        )

        message = cast(Any, response).choices[0]["message"]
        self.state["messages"].append(message)

        if message.get("tool_calls"):
            if message["tool_calls"][0]["function"]["name"] == self.crew_name:
                # run the crew
                crew_function = crew_chat_create_tool_function(self.crew, messages)
                args = json.loads(message["tool_calls"][0]["function"]["arguments"])
                result = crew_function(**args)
                self.state["messages"].append({
                    "role": "tool",
                    "content": result,
                    "tool_call_id": message["tool_calls"][0]["id"]
                })
            elif message["tool_calls"][0]["function"]["name"] == "crew_exit":
                await copilotkit_exit()
                self.state["messages"].append({
                    "role": "tool",
                    "content": "Crew exited",
                    "tool_call_id": message["tool_calls"][0]["id"]
                })

                response = copilotkit_stream(
                    completion(
                        model=self.crew.chat_llm,
                        messages = [
                            {
                                "role": "system",
                                "content": "Indicate to the user that the crew has exited",
                                "id": self.thread_id + "-system"
                            },
                            *self.state["messages"]
                        ],
                        tools=tools,
                        parallel_tool_calls=False,
                        stream=True,
                        tool_choice="none"
                    )
                )
                message = cast(Any, response).choices[0]["message"]
                self.state["messages"].append(message)
