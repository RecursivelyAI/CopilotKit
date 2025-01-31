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
from typing import Optional, List, Callable, Type
from typing_extensions import TypedDict, NotRequired, Any, Dict
from crewai import Crew, Flow
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
  copilotkit_message_to_crewai_crew,
  copilotkit_messages_to_crewai_flow,
  CopilotKitCrewAIFlowEventType,
  crewai_flow_messages_to_copilotkit,
  _crewai_flow_thread_runner
)

class CopilotKitConfig(TypedDict):
    """
    CopilotKit config for CrewAIAgent
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
    """Agent class for CopilotKit"""
    def __init__(
            self,
            *,
            name: str,
            description: Optional[str] = None,
            crew: Optional[Type[Crew]] = None,
            crew_input_key: Optional[str] = None,
            flow: Optional[Type[Flow]] = None,
            copilotkit_config: Optional[CopilotKitConfig] = None,
        ):
        super().__init__(
            name=name,
            description=description,
        )
        if (crew is None) == (flow is None):
            raise ValueError("Either crew or flow must be provided to CrewAIAgent")


        self.crew = crew
        self.crew_input_key = crew_input_key or "input"
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
            return self.execute_crew(
                state=state,
                messages=messages,
                thread_id=thread_id,
                actions=actions,
                **kwargs
            )

        return self.execute_flow(
            state=state,
            messages=messages,
            thread_id=thread_id,
            actions=actions,
            **kwargs
        )

    def execute_crew( # pylint: disable=too-many-arguments,unused-argument
        self,
        *,
        state: dict,
        messages: List[Message],
        thread_id: Optional[str] = None,
        actions: Optional[List[ActionDict]] = None,
        **kwargs,
    ):
        """Execute a `Crew` based agent"""                

        if self.crew is None:
            raise ValueError("Crew is not set")

        crew = self.crew()

        crew_text_input = ""
        if len(messages) > 0:
            # filter out the first message if it's a system message
            if "role" in messages[0] and messages[0]["role"] == "system":
                messages = messages[1:]

        if len(messages) > 0:
            if "content" in messages[-1]:
                crew_text_input = messages[-1]['content']
            elif "result" in messages[-1]:
                crew_text_input = messages[-1]['result']

        crew_chat_messages = json.dumps(
            [copilotkit_message_to_crewai_crew(message) for message in messages]
        )

        inputs = {
            self.crew_input_key: crew_text_input,
            "crew_chat_messages": crew_chat_messages
        }
        output = crew.kickoff(inputs=inputs)
        message_id = str(uuid.uuid4())

        yield emit_runtime_events(
            text_message_start(message_id=message_id),
            text_message_content(message_id=message_id, content=output.raw),
            text_message_end(message_id=message_id)
        )

    async def execute_flow( # pylint: disable=too-many-arguments,unused-argument
        self,
        *,
        state: dict,
        messages: List[Message],
        thread_id: Optional[str] = None,
        actions: Optional[List[ActionDict]] = None,
        **kwargs,
    ):
        """Execute a `Flow` based agent"""

        if self.flow is None:
            raise ValueError("Flow is not set")

        if thread_id is None:
            raise ValueError("Thread ID is required")

        flow = self.flow()
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
    print(f"Predicting state for thread_id: {thread_id}, agent_name: {agent_name}, run_id: {run_id}", flush=True)
    print(f"Event data received: {event_data}", flush=True)
    
    if event_data["type"] == CopilotKitCrewAIFlowEventType.ACTION_EXECUTION_START:
        execution_state["current_tool_call"] = event_data["action_name"]
        execution_state["argument_buffer"] = ""
        print(f"Action execution started: {event_data['action_name']}", flush=True)
    elif event_data["type"] == CopilotKitCrewAIFlowEventType.ACTION_EXECUTION_ARGS:
        execution_state["argument_buffer"] += event_data["args"]
        print(f"Action execution arguments received: {event_data['args']}", flush=True)

        tool_names = [
            config.get("tool_name")
            for config in execution_state["predict_state_configuration"].values()
        ]
        print(f"Configured tool names: {tool_names}", flush=True)

        if execution_state["current_tool_call"] not in tool_names:
            print(f"Current tool call {execution_state['current_tool_call']} not in configured tool names {tool_names}, returning None", flush=True)
            return None

        current_arguments = {}
        try:
            print(f"Parsing arguments: '{execution_state['argument_buffer']}'", flush=True)
            current_arguments = PartialJSONParser().parse(execution_state["argument_buffer"])
            print(f"Parsed current arguments: {current_arguments}", flush=True)
        except Exception as e:  # pylint: disable=broad-except
            print(f"Error parsing arguments: {e}", flush=True)
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
                        print(f"Updated predicted state for key {k} with argument value {argument_value}", flush=True)
                else:
                    execution_state["predicted_state"][k] = current_arguments
                    emit_update = True
                    print(f"Updated predicted state for key {k} with current arguments {current_arguments}", flush=True)

        if emit_update:
            print("Emitting updated state", flush=True)
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

        print("No updates to emit, returning None", flush=True)
        return None
