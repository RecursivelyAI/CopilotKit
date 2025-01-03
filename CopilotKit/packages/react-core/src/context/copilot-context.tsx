import { CopilotCloudConfig, FunctionCallHandler } from "@copilotkit/shared";
import { ActionRenderProps, FrontendAction } from "../types/frontend-action";
import React, { JSX } from "react";
import { TreeNodeId } from "../hooks/use-tree";
import { DocumentPointer } from "../types";
import { CopilotChatSuggestionConfiguration } from "../types/chat-suggestion-configuration";
import { CoAgentStateRender, CoAgentStateRenderProps } from "../types/coagent-action";
import { CoagentState } from "../types/coagent-state";
import { CopilotRuntimeClient } from "@copilotkit/runtime-client-gql";

/**
 * Interface for the configuration of the Copilot API.
 */
export interface CopilotApiConfig {
  /**
   * The public API key for Copilot Cloud.
   */
  publicApiKey?: string;

  /**
   * The configuration for Copilot Cloud.
   */
  cloud?: CopilotCloudConfig;

  /**
   * The endpoint for the chat API.
   */
  chatApiEndpoint: string;

  /**
   * The endpoint for the Copilot transcribe audio service.
   */
  transcribeAudioUrl?: string;

  /**
   * The endpoint for the Copilot text to speech service.
   */
  textToSpeechUrl?: string;

  /**
   * additional headers to be sent with the request
   * @default {}
   * @example
   * ```
   * {
   *   'Authorization': 'Bearer your_token_here'
   * }
   * ```
   */
  headers: Record<string, string>;

  /**
   * Custom properties to be sent with the request
   * @default {}
   * @example
   * ```
   * {
   *   'user_id': 'user_id'
   * }
   * ```
   */
  properties?: Record<string, any>;

  /**
   * Indicates whether the user agent should send or receive cookies from the other domain
   * in the case of cross-origin requests.
   */
  credentials?: RequestCredentials;
}

export type InChatRenderFunction = (props: ActionRenderProps<any>) => string | JSX.Element;
export type CoagentInChatRenderFunction = (
  props: CoAgentStateRenderProps<any>,
) => string | JSX.Element | undefined | null;

export interface ChatComponentsCache {
  actions: Record<string, InChatRenderFunction | string>;
  coAgentStateRenders: Record<string, CoagentInChatRenderFunction | string>;
}

export interface AgentSession {
  agentName: string;
  threadId?: string;
  nodeName?: string;
}

export interface CopilotContextParams {
  // function-calling
  actions: Record<string, FrontendAction<any>>;
  setAction: (id: string, action: FrontendAction<any>) => void;
  removeAction: (id: string) => void;

  // coagent actions
  coAgentStateRenders: Record<string, CoAgentStateRender<any>>;
  setCoAgentStateRender: (id: string, stateRender: CoAgentStateRender<any>) => void;
  removeCoAgentStateRender: (id: string) => void;

  chatComponentsCache: React.RefObject<ChatComponentsCache>;

  getFunctionCallHandler: (
    customEntryPoints?: Record<string, FrontendAction<any>>,
  ) => FunctionCallHandler;

  // text context
  addContext: (context: string, parentId?: string, categories?: string[]) => TreeNodeId;
  removeContext: (id: TreeNodeId) => void;
  getContextString: (documents: DocumentPointer[], categories: string[]) => string;

  // document context
  addDocumentContext: (documentPointer: DocumentPointer, categories?: string[]) => TreeNodeId;
  removeDocumentContext: (documentId: string) => void;
  getDocumentsContext: (categories: string[]) => DocumentPointer[];

  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;

  chatSuggestionConfiguration: { [key: string]: CopilotChatSuggestionConfiguration };
  addChatSuggestionConfiguration: (
    id: string,
    suggestion: CopilotChatSuggestionConfiguration,
  ) => void;
  removeChatSuggestionConfiguration: (id: string) => void;

  chatInstructions: string;
  setChatInstructions: React.Dispatch<React.SetStateAction<string>>;

  // api endpoints
  copilotApiConfig: CopilotApiConfig;

  showDevConsole: boolean | "auto";

  // agents
  coagentStates: Record<string, CoagentState>;
  setCoagentStates: React.Dispatch<React.SetStateAction<Record<string, CoagentState>>>;
  coagentStatesRef: React.RefObject<Record<string, CoagentState>>;
  setCoagentStatesWithRef: (
    value:
      | Record<string, CoagentState>
      | ((prev: Record<string, CoagentState>) => Record<string, CoagentState>),
  ) => void;

  agentSession: AgentSession | null;
  setAgentSession: React.Dispatch<React.SetStateAction<AgentSession | null>>;

  // runtime
  runtimeClient: CopilotRuntimeClient;
}

const emptyCopilotContext: CopilotContextParams = {
  actions: {},
  setAction: () => {},
  removeAction: () => {},

  coAgentStateRenders: {},
  setCoAgentStateRender: () => {},
  removeCoAgentStateRender: () => {},

  chatComponentsCache: { current: { actions: {}, coAgentStateRenders: {} } },
  getContextString: (documents: DocumentPointer[], categories: string[]) =>
    returnAndThrowInDebug(""),
  addContext: () => "",
  removeContext: () => {},

  getFunctionCallHandler: () => returnAndThrowInDebug(async () => {}),

  isLoading: false,
  setIsLoading: () => returnAndThrowInDebug(false),

  chatInstructions: "",
  setChatInstructions: () => returnAndThrowInDebug(""),

  getDocumentsContext: (categories: string[]) => returnAndThrowInDebug([]),
  addDocumentContext: () => returnAndThrowInDebug(""),
  removeDocumentContext: () => {},
  runtimeClient: {} as any,

  copilotApiConfig: new (class implements CopilotApiConfig {
    get chatApiEndpoint(): string {
      throw new Error("Remember to wrap your app in a `<CopilotKit> {...} </CopilotKit>` !!!");
    }

    get headers(): Record<string, string> {
      return {};
    }
    get body(): Record<string, any> {
      return {};
    }
  })(),

  chatSuggestionConfiguration: {},
  addChatSuggestionConfiguration: () => {},
  removeChatSuggestionConfiguration: () => {},
  showDevConsole: "auto",
  coagentStates: {},
  setCoagentStates: () => {},
  coagentStatesRef: { current: {} },
  setCoagentStatesWithRef: () => {},

  agentSession: null,
  setAgentSession: () => {},
};

export const CopilotContext = React.createContext<CopilotContextParams>(emptyCopilotContext);

export function useCopilotContext(): CopilotContextParams {
  const context = React.useContext(CopilotContext);
  if (context === emptyCopilotContext) {
    throw new Error("Remember to wrap your app in a `<CopilotKit> {...} </CopilotKit>` !!!");
  }
  return context;
}

function returnAndThrowInDebug<T>(value: T): T {
  throw new Error("Remember to wrap your app in a `<CopilotKit> {...} </CopilotKit>` !!!");
  return value;
}
