"""FastAPI integration"""

import logging
import asyncio
import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import List, Any, cast, Optional
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse, HTMLResponse
from ..sdk import CopilotKitRemoteEndpoint, CopilotKitContext
from ..types import Message, MetaEvent
from ..exc import (
    ActionNotFoundException,
    ActionExecutionException,
    AgentNotFoundException,
    AgentExecutionException,
)
from ..action import ActionDict
from ..html import generate_info_html
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

def add_fastapi_endpoint(
        fastapi_app: FastAPI,
        sdk: CopilotKitRemoteEndpoint,
        prefix: str,
        *,
        max_workers: int = 10,
        use_thread_pool: bool = True,
    ):
    """Add FastAPI endpoint with configurable ThreadPoolExecutor size"""
    executor = ThreadPoolExecutor(max_workers=max_workers)

    print(f"use_thread_pool {use_thread_pool}")

    def run_handler_in_thread(request: Request, sdk: CopilotKitRemoteEndpoint):
        # Run the handler coroutine in the event loop        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(handler(request, sdk))

    async def make_handler(request: Request):
        if use_thread_pool:
            loop = asyncio.get_event_loop()
            future = loop.run_in_executor(executor, run_handler_in_thread, request, sdk)
            return await future
        return await handler(request, sdk)

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
    except: # pylint: disable=bare-except
        body = None

    path = request.path_params.get('path')
    method = request.method
    context = cast(
        CopilotKitContext,
        {
            "properties": (body or {}).get("properties", {}),
            "frontend_url": (body or {}).get("frontendUrl", None)
        }
    )

    # handle / request for info endpoint
    if method in ['GET', 'POST'] and path == '':
        accept_header = request.headers.get('accept', '')
        return await handle_info(
            sdk=sdk,
            context=context,
            as_html='text/html' in accept_header,
        )

    # handle /agent/name request for executing an agent
    if method == 'POST' and (match := re.match(r'agent/([a-zA-Z0-9_-]+)', path)):
        name = match.group(1)
        body = body or {}

        thread_id = body.get("threadId", str(uuid.uuid4()))
        state = body.get("state", {})
        messages = body.get("messages", [])
        actions = body.get("actions", [])

        # used for LangGraph only
        node_name = body.get("nodeName")

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

    # handle /agent/name/state request for getting agent state
    if method == 'POST' and (match := re.match(r'agent/([a-zA-Z0-9_-]+)/state', path)):
        name = match.group(1)
        thread_id = body_get_or_raise(body, "threadId")

        return handle_get_agent_state(
            sdk=sdk,
            context=context,
            thread_id=thread_id,
            name=name,
        )

    # handle /action/name request for executing an action
    if method == 'POST' and (match := re.match(r'action/([a-zA-Z0-9_-]+)', path)):
        name = match.group(1)
        arguments = body.get("arguments", {})

        return await handle_execute_action(
            sdk=sdk,
            context=context,
            name=name,
            arguments=arguments,
        )

    # v2: POST /agents/name/state

    # Deal with backwards compatibility
    result_v1 = await handler_v1(
        sdk=sdk,
        method=method,
        path=path,
        body=body,
        context=context,
    )

    if result_v1 is not None:
        return result_v1


    raise HTTPException(status_code=404, detail="Not found")

async def handler_v1(
        sdk: CopilotKitRemoteEndpoint,
        method: str,
        path: str,
        body: Any,
        context: CopilotKitContext,
    ):
    """Handle FastAPI request for v1"""

    if body is None:
        raise HTTPException(status_code=400, detail="Request body is required")

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
        meta_events = cast(List[MetaEvent], body.get("metaEvents", []))

        return handle_execute_agent(
            sdk=sdk,
            context=context,
            thread_id=thread_id,
            node_name=node_name,
            name=name,
            state=state,
            messages=messages,
            actions=actions,
            meta_events=meta_events,
        )


    if method == 'POST' and path == 'agents/state':
        thread_id = body_get_or_raise(body, "threadId")
        name = body_get_or_raise(body, "name")

        return handle_get_agent_state(
            sdk=sdk,
            context=context,
            thread_id=thread_id,
            name=name,
        )

    return None


async def handle_info(
        *,
        sdk: CopilotKitRemoteEndpoint,
        context: CopilotKitContext,
        as_html: bool = False,
    ):
    """Handle info request with FastAPI"""
    result = sdk.info(context=context)
    if as_html:
        return HTMLResponse(content=generate_info_html(result))
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
        name: str,
        state: dict,
        messages: List[Message],
        actions: List[ActionDict],
        node_name: str,
        meta_events: Optional[List[MetaEvent]] = None,
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
            meta_events=meta_events,
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

def handle_get_agent_state(
        *,
        sdk: CopilotKitRemoteEndpoint,
        context: CopilotKitContext,
        thread_id: str,
        name: str,
    ):
    """Handle get agent state request with FastAPI"""
    try:
        result = sdk.get_agent_state(
            context=context,
            thread_id=thread_id,
            name=name,
        )
        return JSONResponse(content=result)
    except AgentNotFoundException as exc:
        logger.error("Agent not found: %s", exc, exc_info=True)
        return JSONResponse(content={"error": str(exc)}, status_code=404)
    except Exception as exc: # pylint: disable=broad-except
        logger.error("Agent get state error: %s", exc, exc_info=True)
        return JSONResponse(content={"error": str(exc)}, status_code=500)
