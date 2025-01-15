"""
This is the main entry point for the AI.
It defines the workflow graph and the entry point for the agent.
"""
# pylint: disable=line-too-long, unused-import

from typing import cast, TypedDict, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, ToolMessage, AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import MessagesState
from copilotkit.langgraph import copilotkit_customize_config

class Translations(TypedDict):
    """Contains the translations in four different languages."""
    translation_es: str
    translation_fr: str
    translation_de: str

class AgentState(MessagesState):
    """Contains the state of the agent."""
    translations: Translations
    input: str

async def translate_node(state: AgentState, config: RunnableConfig):
    """Chatbot that translates text"""

    config = copilotkit_customize_config(
        config,
        # config emits messages by default, so this is not needed:
        ## emit_messages=True,
        emit_intermediate_state=[
            {
                "state_key": "translations",
                "tool": "translate"
            }
        ]
    )

    model = ChatOpenAI(model="gpt-4o").bind_tools(
        [Translations],
        parallel_tool_calls=False,
        tool_choice=(
            None if state["messages"] and
            isinstance(state["messages"][-1], HumanMessage)
            else "Translations"
        )
    )

    response = await model.ainvoke([
        SystemMessage(
            content=f"""
            You are a helpful assistant that translates text to different languages 
            (Spanish, French and German).
            Don't ask for confirmation before translating.
            {
                'The user is currently working on translating this text: "' + 
                state["input"] + '"' if state.get("input") else ""
            }
            """
        ),
        *state["messages"],
    ], config)

    if hasattr(response, "tool_calls") and len(getattr(response, "tool_calls")) > 0:
        ai_message = cast(AIMessage, response)
        return {
            "messages": [
                response,
                ToolMessage(
                    content="Translated!",
                    tool_call_id=ai_message.tool_calls[0]["id"]
                )
            ],
            "translations": cast(AIMessage, response).tool_calls[0]["args"],
        }

    return {
        "messages": [           
            response,
        ],
    }

workflow = StateGraph(AgentState)
workflow.add_node("translate_node", cast(Any, translate_node))
workflow.set_entry_point("translate_node")
workflow.add_edge("translate_node", END)
memory = MemorySaver()
graph = workflow.compile(checkpointer=memory)
