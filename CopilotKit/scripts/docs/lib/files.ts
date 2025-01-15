import { ReferenceDocConfiguration } from "./reference-doc";

export const REFERENCE_DOCS: ReferenceDocConfiguration[] = [
  /* Runtime */
  {
    sourcePath: "packages/runtime/src/service-adapters/google/google-genai-adapter.ts",
    destinationPath:
      "docs/content/docs/reference/classes/llm-adapters/GoogleGenerativeAIAdapter.mdx",
    className: "GoogleGenerativeAIAdapter",
    description: "Copilot Runtime adapter for Google Generative AI (e.g. Gemini).",
  },
  {
    sourcePath: "packages/runtime/src/service-adapters/groq/groq-adapter.ts",
    destinationPath: "docs/content/docs/reference/classes/llm-adapters/GroqAdapter.mdx",
    className: "GroqAdapter",
    description: "Copilot Runtime adapter for Groq.",
  },
  {
    sourcePath: "packages/runtime/src/service-adapters/langchain/langchain-adapter.ts",
    destinationPath: "docs/content/docs/reference/classes/llm-adapters/LangChainAdapter.mdx",
    className: "LangChainAdapter",
    description: "Copilot Runtime adapter for LangChain.",
  },
  {
    sourcePath: "packages/runtime/src/service-adapters/openai/openai-adapter.ts",
    destinationPath: "docs/content/docs/reference/classes/llm-adapters/OpenAIAdapter.mdx",
    className: "OpenAIAdapter",
    description: "Copilot Runtime adapter for OpenAI.",
  },
  {
    sourcePath: "packages/runtime/src/service-adapters/openai/openai-assistant-adapter.ts",
    destinationPath: "docs/content/docs/reference/classes/llm-adapters/OpenAIAssistantAdapter.mdx",
    className: "OpenAIAssistantAdapter",
    description: "Copilot Runtime adapter for OpenAI Assistant API.",
  },
  {
    sourcePath: "packages/runtime/src/service-adapters/anthropic/anthropic-adapter.ts",
    destinationPath: "docs/content/docs/reference/classes/llm-adapters/AnthropicAdapter.mdx",
    className: "AnthropicAdapter",
    description: "Copilot Runtime adapter for Anthropic.",
  },
  /* Classes */
  {
    sourcePath: "packages/react-core/src/lib/copilot-task.ts",
    destinationPath: "docs/content/docs/reference/classes/CopilotTask.mdx",
    className: "CopilotTask",
    description: "CopilotTask is used to execute one-off tasks, for example on button click.",
  },
  {
    sourcePath: "packages/runtime/src/lib/runtime/copilot-runtime.ts",
    destinationPath: "docs/content/docs/reference/classes/CopilotRuntime.mdx",
    className: "CopilotRuntime",
    description:
      "Copilot Runtime is the back-end component of CopilotKit, enabling interaction with LLMs.",
  },
  /* Components */
  {
    sourcePath: "packages/react-ui/src/components/chat/Chat.tsx",
    destinationPath: "docs/content/docs/reference/components/chat/CopilotChat.mdx",
    component: "CopilotChat",
    description:
      "The CopilotChat component, providing a chat interface for interacting with your copilot.",
  },
  {
    sourcePath: "packages/react-core/src/components/copilot-provider/copilotkit.tsx",
    destinationPath: "docs/content/docs/reference/components/CopilotKit.mdx",
    component: "CopilotKit",
    description: "The CopilotKit provider component, wrapping your application.",
  },
  {
    sourcePath: "packages/react-ui/src/components/chat/Popup.tsx",
    destinationPath: "docs/content/docs/reference/components/chat/CopilotPopup.mdx",
    component: "CopilotPopup",
    description:
      "The CopilotPopup component, providing a popup interface for interacting with your copilot.",
  },
  {
    sourcePath: "packages/react-ui/src/components/chat/Sidebar.tsx",
    destinationPath: "docs/content/docs/reference/components/chat/CopilotSidebar.mdx",
    component: "CopilotSidebar",
    description:
      "The CopilotSidebar component, providing a sidebar interface for interacting with your copilot.",
  },
  {
    sourcePath: "packages/react-textarea/src/components/copilot-textarea/copilot-textarea.tsx",
    destinationPath: "docs/content/docs/reference/components/CopilotTextarea.mdx",
    component: "CopilotTextarea",
    description:
      "An AI-powered textarea component for your application, which serves as a drop-in replacement for any textarea.",
  },
  /* Hooks */
  {
    sourcePath: "packages/react-core/src/hooks/use-copilot-chat.ts",
    destinationPath: "docs/content/docs/reference/hooks/useCopilotChat.mdx",
    hook: "useCopilotChat",
  },
  {
    sourcePath: "packages/react-ui/src/hooks/use-copilot-chat-suggestions.tsx",
    destinationPath: "docs/content/docs/reference/hooks/useCopilotChatSuggestions.mdx",
    hook: "useCopilotChatSuggestions",
    description:
      "The useCopilotChatSuggestions hook generates suggestions in the chat window based on real-time app state.",
  },
  {
    sourcePath: "packages/react-core/src/hooks/use-copilot-readable.ts",
    destinationPath: "docs/content/docs/reference/hooks/useCopilotReadable.mdx",
    hook: "useCopilotReadable",
    description:
      "The useCopilotReadable hook allows you to provide knowledge to your copilot (e.g. application state).",
  },
  {
    sourcePath: "packages/react-core/src/hooks/use-coagent-state-render.ts",
    destinationPath: "docs/content/docs/reference/hooks/useCoAgentStateRender.mdx",
    hook: "useCoAgentStateRender",
    description: "The useCoAgentStateRender hook allows you to render the state of a coagent.",
  },
  {
    sourcePath: "packages/react-core/src/hooks/use-coagent.ts",
    destinationPath: "docs/content/docs/reference/hooks/useCoAgent.mdx",
    hook: "useCoAgent",
    description:
      "The useCoAgent hook allows you to share state bidirectionally between your application and the agent.",
  },
  /* SDKs */
  {
    sourcePath: "../sdk-python/copilotkit/langgraph.py",
    destinationPath: "docs/content/docs/reference/sdk/python/LangGraph.mdx",
    title: "LangGraph SDK",
    description:
      "The CopilotKit LangGraph SDK for Python allows you to build and run LangGraph workflows with CopilotKit.",
    pythonSymbols: [
      "copilotkit_customize_config",
      "copilotkit_exit",
      "copilotkit_emit_state",
      "copilotkit_emit_message",
      "copilotkit_emit_tool_call",
    ],
  },
  {
    sourcePath: "../sdk-python/copilotkit/langgraph_agent.py",
    destinationPath: "docs/content/docs/reference/sdk/python/LangGraphAgent.mdx",
    title: "LangGraphAgent",
    description: "LangGraphAgent lets you define your agent for use with CopilotKit.",
    pythonSymbols: ["LangGraphAgent", "CopilotKitConfig"],
  },
  {
    sourcePath: "../sdk-python/copilotkit/sdk.py",
    destinationPath: "docs/content/docs/reference/sdk/python/RemoteEndpoints.mdx",
    title: "Remote Endpoints",
    description:
      "CopilotKit Remote Endpoints allow you to connect actions and agents written in Python to your CopilotKit application.",
    pythonSymbols: ["CopilotKitRemoteEndpoint", "CopilotKitContext"],
  },
  {
    sourcePath: "packages/sdk-js/src/langgraph.ts",
    destinationPath: "docs/content/docs/reference/sdk/js/LangGraph.mdx",
    title: "LangGraph SDK",
    description:
      "The CopilotKit LangGraph SDK for JavaScript allows you to build and run LangGraph workflows with CopilotKit.",
    typescriptSymbols: [
      "copilotkitCustomizeConfig",
      "copilotkitExit",
      "copilotkitEmitState",
      "copilotkitEmitMessage",
      "copilotkitEmitToolCall",
    ],
  },
];
