/**
 * This component will typically wrap your entire application (or a sub-tree of your application where you want to have a copilot). It provides the copilot context to all other components and hooks.
 *
 * ## Example
 *
 * You can find more information about self-hosting CopilotKit [here](/guides/self-hosting).
 *
 * ```tsx
 * import { CopilotKit } from "@copilotkit/react-core";
 *
 * <CopilotKit runtimeUrl="<your-runtime-url>">
 *   // ... your app ...
 * </CopilotKit>
 * ```
 */

import { useCallback, useEffect, useMemo, useRef, useState, SetStateAction } from "react";
import {
  CopilotContext,
  CopilotApiConfig,
  ChatComponentsCache,
  AgentSession,
  AuthState,
} from "../../context/copilot-context";
import useTree from "../../hooks/use-tree";
import { CopilotChatSuggestionConfiguration, DocumentPointer } from "../../types";
import { flushSync } from "react-dom";
import {
  COPILOT_CLOUD_CHAT_URL,
  CopilotCloudConfig,
  FunctionCallHandler,
  COPILOT_CLOUD_PUBLIC_API_KEY_HEADER,
  randomUUID,
  ConfigurationError,
  MissingPublicApiKeyError,
} from "@copilotkit/shared";
import { FrontendAction } from "../../types/frontend-action";
import useFlatCategoryStore from "../../hooks/use-flat-category-store";
import { CopilotKitProps } from "./copilotkit-props";
import { CoAgentStateRender } from "../../types/coagent-action";
import { CoagentState } from "../../types/coagent-state";
import { CopilotMessages } from "./copilot-messages";
import { ToastProvider } from "../toast/toast-provider";
import { useCopilotRuntimeClient } from "../../hooks/use-copilot-runtime-client";
import { shouldShowDevConsole } from "../../utils";
import { CopilotErrorBoundary } from "../error-boundary/error-boundary";
import { Agent, ExtensionsInput } from "@copilotkit/runtime-client-gql";

export function CopilotKit({ children, ...props }: CopilotKitProps) {
  const showDevConsole = props.showDevConsole === undefined ? "auto" : props.showDevConsole;
  const enabled = shouldShowDevConsole(showDevConsole);

  return (
    <ToastProvider enabled={enabled}>
      <CopilotErrorBoundary publicApiKey={props.publicApiKey} showUsageBanner={enabled}>
        <CopilotKitInternal {...props}>{children}</CopilotKitInternal>
      </CopilotErrorBoundary>
    </ToastProvider>
  );
}

export function CopilotKitInternal(cpkProps: CopilotKitProps) {
  const { children, ...props } = cpkProps;

  /**
   * This will throw an error if the props are invalid.
   */
  validateProps(cpkProps);

  const chatApiEndpoint = props.runtimeUrl || COPILOT_CLOUD_CHAT_URL;

  const [actions, setActions] = useState<Record<string, FrontendAction<any>>>({});
  const [coAgentStateRenders, setCoAgentStateRenders] = useState<
    Record<string, CoAgentStateRender<any>>
  >({});

  const chatComponentsCache = useRef<ChatComponentsCache>({
    actions: {},
    coAgentStateRenders: {},
  });

  const { addElement, removeElement, printTree } = useTree();
  const [isLoading, setIsLoading] = useState(false);
  const [chatInstructions, setChatInstructions] = useState("");
  const [authStates, setAuthStates] = useState<Record<string, AuthState>>({});
  const [extensions, setExtensions] = useState<ExtensionsInput>({});
  const [additionalInstructions, setAdditionalInstructions] = useState<string[]>([]);

  const {
    addElement: addDocument,
    removeElement: removeDocument,
    allElements: allDocuments,
  } = useFlatCategoryStore<DocumentPointer>();

  // Compute all the functions and properties that we need to pass

  const setAction = useCallback((id: string, action: FrontendAction<any>) => {
    setActions((prevPoints) => {
      return {
        ...prevPoints,
        [id]: action,
      };
    });
  }, []);

  const removeAction = useCallback((id: string) => {
    setActions((prevPoints) => {
      const newPoints = { ...prevPoints };
      delete newPoints[id];
      return newPoints;
    });
  }, []);

  const setCoAgentStateRender = useCallback((id: string, stateRender: CoAgentStateRender<any>) => {
    setCoAgentStateRenders((prevPoints) => {
      return {
        ...prevPoints,
        [id]: stateRender,
      };
    });
  }, []);

  const removeCoAgentStateRender = useCallback((id: string) => {
    setCoAgentStateRenders((prevPoints) => {
      const newPoints = { ...prevPoints };
      delete newPoints[id];
      return newPoints;
    });
  }, []);

  const getContextString = useCallback(
    (documents: DocumentPointer[], categories: string[]) => {
      const documentsString = documents
        .map((document) => {
          return `${document.name} (${document.sourceApplication}):\n${document.getContents()}`;
        })
        .join("\n\n");

      const nonDocumentStrings = printTree(categories);

      return `${documentsString}\n\n${nonDocumentStrings}`;
    },
    [printTree],
  );

  const addContext = useCallback(
    (
      context: string,
      parentId?: string,
      categories: string[] = defaultCopilotContextCategories,
    ) => {
      return addElement(context, categories, parentId);
    },
    [addElement],
  );

  const removeContext = useCallback(
    (id: string) => {
      removeElement(id);
    },
    [removeElement],
  );

  const getFunctionCallHandler = useCallback(
    (customEntryPoints?: Record<string, FrontendAction<any>>) => {
      return entryPointsToFunctionCallHandler(Object.values(customEntryPoints || actions));
    },
    [actions],
  );

  const getDocumentsContext = useCallback(
    (categories: string[]) => {
      return allDocuments(categories);
    },
    [allDocuments],
  );

  const addDocumentContext = useCallback(
    (documentPointer: DocumentPointer, categories: string[] = defaultCopilotContextCategories) => {
      return addDocument(documentPointer, categories);
    },
    [addDocument],
  );

  const removeDocumentContext = useCallback(
    (documentId: string) => {
      removeDocument(documentId);
    },
    [removeDocument],
  );

  // get the appropriate CopilotApiConfig from the props
  const copilotApiConfig: CopilotApiConfig = useMemo(() => {
    let cloud: CopilotCloudConfig | undefined = undefined;
    if (props.publicApiKey) {
      cloud = {
        guardrails: {
          input: {
            restrictToTopic: {
              enabled: props.cloudRestrictToTopic ? true : false,
              validTopics: props.cloudRestrictToTopic?.validTopics || [],
              invalidTopics: props.cloudRestrictToTopic?.invalidTopics || [],
            },
          },
        },
      };
    }

    return {
      publicApiKey: props.publicApiKey,
      ...(cloud ? { cloud } : {}),
      chatApiEndpoint: chatApiEndpoint,
      headers: props.headers || {},
      properties: props.properties || {},
      transcribeAudioUrl: props.transcribeAudioUrl,
      textToSpeechUrl: props.textToSpeechUrl,
      credentials: props.credentials,
    };
  }, [
    props.publicApiKey,
    props.headers,
    props.properties,
    props.transcribeAudioUrl,
    props.textToSpeechUrl,
    props.credentials,
    props.cloudRestrictToTopic,
  ]);

  const headers = useMemo(() => {
    const authHeaders = Object.values(authStates || {}).reduce((acc, state) => {
      if (state.status === "authenticated" && state.authHeaders) {
        return {
          ...acc,
          ...Object.entries(state.authHeaders).reduce(
            (headers, [key, value]) => ({
              ...headers,
              [key.startsWith("X-Custom-") ? key : `X-Custom-${key}`]: value,
            }),
            {},
          ),
        };
      }
      return acc;
    }, {});

    return {
      ...(copilotApiConfig.headers || {}),
      ...(copilotApiConfig.publicApiKey
        ? { [COPILOT_CLOUD_PUBLIC_API_KEY_HEADER]: copilotApiConfig.publicApiKey }
        : {}),
      ...authHeaders,
    };
  }, [copilotApiConfig.headers, copilotApiConfig.publicApiKey, authStates]);

  const runtimeClient = useCopilotRuntimeClient({
    url: copilotApiConfig.chatApiEndpoint,
    publicApiKey: copilotApiConfig.publicApiKey,
    headers,
    credentials: copilotApiConfig.credentials,
  });

  const [chatSuggestionConfiguration, setChatSuggestionConfiguration] = useState<{
    [key: string]: CopilotChatSuggestionConfiguration;
  }>({});

  const addChatSuggestionConfiguration = (
    id: string,
    suggestion: CopilotChatSuggestionConfiguration,
  ) => {
    setChatSuggestionConfiguration((prev) => ({ ...prev, [id]: suggestion }));
  };

  const removeChatSuggestionConfiguration = (id: string) => {
    setChatSuggestionConfiguration((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [coagentStates, setCoagentStates] = useState<Record<string, CoagentState>>({});
  const coagentStatesRef = useRef<Record<string, CoagentState>>({});
  const setCoagentStatesWithRef = useCallback(
    (
      value:
        | Record<string, CoagentState>
        | ((prev: Record<string, CoagentState>) => Record<string, CoagentState>),
    ) => {
      const newValue = typeof value === "function" ? value(coagentStatesRef.current) : value;
      coagentStatesRef.current = newValue;
      setCoagentStates((prev) => {
        return newValue;
      });
    },
    [],
  );

  useEffect(() => {
    const fetchData = async () => {
      const result = await runtimeClient.availableAgents();
      if (result.data?.availableAgents) {
        setAvailableAgents(result.data.availableAgents.agents);
      }
    };
    void fetchData();
  }, []);

  let initialAgentSession: AgentSession | null = null;
  if (props.agent) {
    initialAgentSession = {
      agentName: props.agent,
    };
  }

  const [agentSession, setAgentSession] = useState<AgentSession | null>(initialAgentSession);

  const [internalThreadId, setInternalThreadId] = useState<string>(props.threadId || randomUUID());
  const setThreadId = useCallback(
    (value: SetStateAction<string>) => {
      if (props.threadId) {
        throw new Error("Cannot call setThreadId() when threadId is provided via props.");
      }
      setInternalThreadId(value);
    },
    [props.threadId],
  );

  // update the internal threadId if the props.threadId changes
  useEffect(() => {
    if (props.threadId !== undefined) {
      setInternalThreadId(props.threadId);
    }
  }, [props.threadId]);

  const [runId, setRunId] = useState<string | null>(null);

  const chatAbortControllerRef = useRef<AbortController | null>(null);

  const showDevConsole = props.showDevConsole === undefined ? "auto" : props.showDevConsole;

  return (
    <CopilotContext.Provider
      value={{
        actions,
        chatComponentsCache,
        getFunctionCallHandler,
        setAction,
        removeAction,
        coAgentStateRenders,
        setCoAgentStateRender,
        removeCoAgentStateRender,
        getContextString,
        addContext,
        removeContext,
        getDocumentsContext,
        addDocumentContext,
        removeDocumentContext,
        copilotApiConfig: copilotApiConfig,
        isLoading,
        setIsLoading,
        chatSuggestionConfiguration,
        addChatSuggestionConfiguration,
        removeChatSuggestionConfiguration,
        chatInstructions,
        setChatInstructions,
        additionalInstructions,
        setAdditionalInstructions,
        showDevConsole,
        coagentStates,
        setCoagentStates,
        coagentStatesRef,
        setCoagentStatesWithRef,
        agentSession,
        setAgentSession,
        runtimeClient,
        forwardedParameters: props.forwardedParameters || {},
        agentLock: props.agent || null,
        threadId: internalThreadId,
        setThreadId,
        runId,
        setRunId,
        chatAbortControllerRef,
        availableAgents,
        authConfig_c: props.authConfig_c,
        authStates_c: authStates,
        setAuthStates_c: setAuthStates,
        extensions,
        setExtensions,
      }}
    >
      <CopilotMessages>{children}</CopilotMessages>
    </CopilotContext.Provider>
  );
}

export const defaultCopilotContextCategories = ["global"];

function entryPointsToFunctionCallHandler(actions: FrontendAction<any>[]): FunctionCallHandler {
  return async ({ name, args }) => {
    let actionsByFunctionName: Record<string, FrontendAction<any>> = {};
    for (let action of actions) {
      actionsByFunctionName[action.name] = action;
    }

    const action = actionsByFunctionName[name];
    let result: any = undefined;
    if (action) {
      await new Promise<void>((resolve, reject) => {
        flushSync(async () => {
          try {
            result = await action.handler?.(args);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return result;
  };
}

function formatFeatureName(featureName: string): string {
  return featureName
    .replace(/_c$/, "")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function validateProps(props: CopilotKitProps): never | void {
  const cloudFeatures = Object.keys(props).filter((key) => key.endsWith("_c"));

  if (!props.runtimeUrl && !props.publicApiKey) {
    throw new ConfigurationError("Missing required prop: 'runtimeUrl' or 'publicApiKey'");
  }

  if (cloudFeatures.length > 0 && !props.publicApiKey) {
    throw new MissingPublicApiKeyError(
      `Missing required prop: 'publicApiKey' to use cloud features: ${cloudFeatures
        .map(formatFeatureName)
        .join(", ")}`,
    );
  }
}
