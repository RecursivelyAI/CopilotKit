"""FastAPI integration"""

import logging
import asyncio
#
from concurrent.futures import ThreadPoolExecutor
from typing import List, Any, cast
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from ..sdk import CopilotKitRemoteEndpoint, CopilotKitContext
from ..types import Message
from ..exc import (
    ActionNotFoundException,
    ActionExecutionException,
    AgentNotFoundException,
    AgentExecutionException,
)
from ..action import ActionDict

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

def add_fastapi_endpoint(
        fastapi_app: FastAPI,
        sdk: CopilotKitRemoteEndpoint,
        prefix: str,
        *,
        max_workers: int = 10,
    ):
    """Add FastAPI endpoint with configurable ThreadPoolExecutor size"""
    executor = ThreadPoolExecutor(max_workers=max_workers)

    def run_handler_in_thread(request: Request, sdk: CopilotKitRemoteEndpoint):
        # Run the handler coroutine in the event loop        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(handler(request, sdk))
    
    async def make_handler(request: Request):
        loop = asyncio.get_event_loop()
        future = loop.run_in_executor(executor, run_handler_in_thread, request, sdk)
        return await future

    # Ensure the prefix starts with a slash and remove trailing slashes
    normalized_prefix = '/' + prefix.strip('/')

    fastapi_app.add_api_route(
        f"{normalized_prefix}/{{path:path}}",
        make_handler,
        methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    )

def body_get_or_raise(body: Any, key: str):
    """Get value from body or raise an error"""
    value = body.get(key)
    if value is None:
        raise HTTPException(status_code=400, detail=f"{key} is required")
    return value


async def handler(request: Request, sdk: CopilotKitRemoteEndpoint):
    """Handle FastAPI request"""

    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Request body is required") from exc

    path = request.path_params.get('path')
    method = request.method
    context = cast(
        CopilotKitContext, 
        {
            "properties": body.get("properties", {}),
            "frontend_url": body.get("frontendUrl", None)
        }
    )

    if method == 'POST' and path == 'info':
        return await handle_info(sdk=sdk, context=context)

    if method == 'POST' and path == 'actions/execute':
        name = body_get_or_raise(body, "name")
        arguments = body.get("arguments", {})

        return await handle_execute_action(
            sdk=sdk,
            context=context,
            name=name,
            arguments=arguments,
        )

    if method == 'POST' and path == 'agents/execute':
        thread_id = body.get("threadId")
        node_name = body.get("nodeName")

        name = body_get_or_raise(body, "name")
        state = body_get_or_raise(body, "state")
        messages = body_get_or_raise(body, "messages")
        actions = cast(List[ActionDict], body.get("actions", []))

        return handle_execute_agent(
            sdk=sdk,
            context=context,
            thread_id=thread_id,
            node_name=node_name,
            name=name,
            state=state,
            messages=messages,
            actions=actions,
        )


    raise HTTPException(status_code=404, detail="Not found")


async def handle_info(*, sdk: CopilotKitRemoteEndpoint, context: CopilotKitContext):
    """Handle info request with FastAPI"""
    result = sdk.info(context=context)
    return JSONResponse(content=result)

async def handle_execute_action(
        *,
        sdk: CopilotKitRemoteEndpoint,
        context: CopilotKitContext,
        name: str,
        arguments: dict,
    ):
    """Handle execute action request with FastAPI"""
    try:
        result = await sdk.execute_action(
            context=context,
            name=name,
            arguments=arguments
        )
        return JSONResponse(content=result)
    except ActionNotFoundException as exc:
        logger.error("Action not found: %s", exc)
        return JSONResponse(content={"error": str(exc)}, status_code=404)
    except ActionExecutionException as exc:
        logger.error("Action execution error: %s", exc)
        return JSONResponse(content={"error": str(exc)}, status_code=500)
    except Exception as exc: # pylint: disable=broad-except
        logger.error("Action execution error: %s", exc)
        return JSONResponse(content={"error": str(exc)}, status_code=500)

def handle_execute_agent( # pylint: disable=too-many-arguments
        *,
        sdk: CopilotKitRemoteEndpoint,
        context: CopilotKitContext,
        thread_id: str,
        node_name: str,
        name: str,
        state: dict,
        messages: List[Message],
        actions: List[ActionDict],
    ):
    """Handle continue agent execution request with FastAPI"""
    try:
        events = sdk.execute_agent(
            context=context,
            thread_id=thread_id,
            name=name,
            node_name=node_name,
            state=state,
            messages=messages,
            actions=actions,
        )
        return StreamingResponse(events, media_type="application/json")
    except AgentNotFoundException as exc:
        logger.error("Agent not found: %s", exc, exc_info=True)
        return JSONResponse(content={"error": str(exc)}, status_code=404)
    except AgentExecutionException as exc:
        logger.error("Agent execution error: %s", exc, exc_info=True)
        return JSONResponse(content={"error": str(exc)}, status_code=500)
    except Exception as exc: # pylint: disable=broad-except
        logger.error("Agent execution error: %s", exc, exc_info=True)
        return JSONResponse(content={"error": str(exc)}, status_code=500)
