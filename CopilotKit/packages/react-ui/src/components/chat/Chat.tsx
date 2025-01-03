/**
 * <br/>
 * <img src="/images/CopilotChat.gif" width="500" />
 *
 * A chatbot panel component for the CopilotKit framework. The component allows for a high degree
 * of customization through various props and custom CSS.
 *
 * ## Install Dependencies
 *
 * This component is part of the [@copilotkit/react-ui](https://npmjs.com/package/@copilotkit/react-ui) package.
 *
 * ```shell npm2yarn \"@copilotkit/react-ui"\
 * npm install @copilotkit/react-core @copilotkit/react-ui
 * ```
 *
 * ## Usage
 *
 * ```tsx
 * import { CopilotChat } from "@copilotkit/react-ui";
 * import "@copilotkit/react-ui/styles.css";
 *
 * <CopilotChat
 *   labels={{
 *     title: "Your Assistant",
 *     initial: "Hi! 👋 How can I assist you today?",
 *   }}
 * />
 * ```
 *
 * ### Look & Feel
 *
 * By default, CopilotKit components do not have any styles. You can import CopilotKit's stylesheet at the root of your project:
 * ```tsx title="YourRootComponent.tsx"
 * ...
 * import "@copilotkit/react-ui/styles.css"; // [!code highlight]
 *
 * export function YourRootComponent() {
 *   return (
 *     <CopilotKit>
 *       ...
 *     </CopilotKit>
 *   );
 * }
 * ```
 * For more information about how to customize the styles, check out the [Customize Look & Feel](/guides/custom-look-and-feel/customize-built-in-ui-components) guide.
 */

import {
  ChatContext,
  ChatContextProvider,
  CopilotChatIcons,
  CopilotChatLabels,
} from "./ChatContext";
import { Messages as DefaultMessages } from "./Messages";
import { Input as DefaultInput } from "./Input";
import { ResponseButton as DefaultResponseButton } from "./Response";
import { RenderTextMessage as DefaultRenderTextMessage } from "./messages/RenderTextMessage";
import { RenderActionExecutionMessage as DefaultRenderActionExecutionMessage } from "./messages/RenderActionExecutionMessage";
import { RenderResultMessage as DefaultRenderResultMessage } from "./messages/RenderResultMessage";
import { RenderAgentStateMessage as DefaultRenderAgentStateMessage } from "./messages/RenderAgentStateMessage";
import { Suggestion } from "./Suggestion";
import React, { useEffect, useRef, useState } from "react";
import {
  SystemMessageFunction,
  useCopilotChat,
  useCopilotContext,
  useCopilotMessagesContext,
} from "@copilotkit/react-core";
import { reloadSuggestions } from "./Suggestion";
import { CopilotChatSuggestion } from "../../types/suggestions";
import { Message, Role, TextMessage } from "@copilotkit/runtime-client-gql";
import { InputProps, MessagesProps, RenderMessageProps, ResponseButtonProps } from "./props";
import { randomId } from "@copilotkit/shared";

import { CopilotDevConsole } from "../dev-console";

/**
 * Props for CopilotChat component.
 */
export interface CopilotChatProps {
  /**
   * Custom instructions to be added to the system message. Use this property to
   * provide additional context or guidance to the language model, influencing
   * its responses. These instructions can include specific directions,
   * preferences, or criteria that the model should consider when generating
   * its output, thereby tailoring the conversation more precisely to the
   * user's needs or the application's requirements.
   */
  instructions?: string;

  /**
   * A callback that gets called when the in progress state changes.
   */
  onInProgress?: (inProgress: boolean) => void;

  /**
   * A callback that gets called when a new message it submitted.
   */
  onSubmitMessage?: (message: string) => void | Promise<void>;

  /**
   * Icons can be used to set custom icons for the chat window.
   */
  icons?: CopilotChatIcons;

  /**
   * Labels can be used to set custom labels for the chat window.
   */
  labels?: CopilotChatLabels;

  /**
   * A function that takes in context string and instructions and returns
   * the system message to include in the chat request.
   * Use this to completely override the system message, when providing
   * instructions is not enough.
   */
  makeSystemMessage?: SystemMessageFunction;

  /**
   * Whether to show the response button.
   * @default true
   */
  showResponseButton?: boolean;

  /**
   * A custom Messages component to use instead of the default.
   */
  Messages?: React.ComponentType<MessagesProps>;

  /**
   * A custom RenderTextMessage component to use instead of the default.
   */
  RenderTextMessage?: React.ComponentType<RenderMessageProps>;

  /**
   * A custom RenderActionExecutionMessage component to use instead of the default.
   */
  RenderActionExecutionMessage?: React.ComponentType<RenderMessageProps>;

  /**
   * A custom RenderAgentStateMessage component to use instead of the default.
   */
  RenderAgentStateMessage?: React.ComponentType<RenderMessageProps>;

  /**
   * A custom RenderResultMessage component to use instead of the default.
   */
  RenderResultMessage?: React.ComponentType<RenderMessageProps>;

  /**
   * A custom Input component to use instead of the default.
   */
  Input?: React.ComponentType<InputProps>;

  /**
   * A custom ResponseButton component to use instead of the default.
   */
  ResponseButton?: React.ComponentType<ResponseButtonProps>;

  /**
   * A class name to apply to the root element.
   */
  className?: string;

  /**
   * Children to render.
   */
  children?: React.ReactNode;
}

export function CopilotChat({
  instructions,
  onSubmitMessage,
  makeSystemMessage,
  showResponseButton = true,
  onInProgress,
  Messages = DefaultMessages,
  RenderTextMessage = DefaultRenderTextMessage,
  RenderActionExecutionMessage = DefaultRenderActionExecutionMessage,
  RenderAgentStateMessage = DefaultRenderAgentStateMessage,
  RenderResultMessage = DefaultRenderResultMessage,
  Input = DefaultInput,
  ResponseButton = DefaultResponseButton,
  className,
  icons,
  labels,
}: CopilotChatProps) {
  const context = useCopilotContext();

  useEffect(() => {
    context.setChatInstructions(instructions || "");
  }, [instructions]);

  const {
    visibleMessages,
    isLoading,
    currentSuggestions,
    sendMessage,
    stopGeneration,
    reloadMessages,
  } = useCopilotChatLogic(makeSystemMessage, onInProgress, onSubmitMessage);

  const chatContext = React.useContext(ChatContext);
  const isVisible = chatContext ? chatContext.open : true;

  return (
    <WrappedCopilotChat icons={icons} labels={labels} className={className}>
      <CopilotDevConsole />
      <Messages
        RenderTextMessage={RenderTextMessage}
        RenderActionExecutionMessage={RenderActionExecutionMessage}
        RenderAgentStateMessage={RenderAgentStateMessage}
        RenderResultMessage={RenderResultMessage}
        messages={visibleMessages}
        inProgress={isLoading}
      >
        {currentSuggestions.length > 0 && (
          <div>
            <h6>Suggested:</h6>
            <div className="suggestions">
              {currentSuggestions.map((suggestion, index) => (
                <Suggestion
                  key={index}
                  title={suggestion.title}
                  message={suggestion.message}
                  partial={suggestion.partial}
                  className={suggestion.className}
                  onClick={(message) => sendMessage(message)}
                />
              ))}
            </div>
          </div>
        )}
        {showResponseButton && visibleMessages.length > 0 && (
          <ResponseButton
            onClick={isLoading ? stopGeneration : reloadMessages}
            inProgress={isLoading}
          />
        )}
      </Messages>
      <Input inProgress={isLoading} onSend={sendMessage} isVisible={isVisible} />
    </WrappedCopilotChat>
  );
}

export function WrappedCopilotChat({
  children,
  icons,
  labels,
  className,
}: {
  children: React.ReactNode;
  icons?: CopilotChatIcons;
  labels?: CopilotChatLabels;
  className?: string;
}) {
  const chatContext = React.useContext(ChatContext);
  if (!chatContext) {
    return (
      <ChatContextProvider icons={icons} labels={labels} open={true} setOpen={() => {}}>
        <div className={`copilotKitChat ${className}`}>{children}</div>
      </ChatContextProvider>
    );
  }
  return <>{children}</>;
}

const SUGGESTIONS_DEBOUNCE_TIMEOUT = 1000;

export const useCopilotChatLogic = (
  makeSystemMessage?: SystemMessageFunction,
  onInProgress?: (isLoading: boolean) => void,
  onSubmitMessage?: (messageContent: string) => Promise<void> | void,
) => {
  const { visibleMessages, appendMessage, reloadMessages, stopGeneration, isLoading } =
    useCopilotChat({
      id: randomId(),
      makeSystemMessage,
    });

  const [currentSuggestions, setCurrentSuggestions] = useState<CopilotChatSuggestion[]>([]);
  const suggestionsAbortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<any>(undefined);

  const abortSuggestions = () => {
    suggestionsAbortControllerRef.current?.abort();
    suggestionsAbortControllerRef.current = null;
  };

  const generalContext = useCopilotContext();
  const messagesContext = useCopilotMessagesContext();
  const context = { ...generalContext, ...messagesContext };

  useEffect(() => {
    onInProgress?.(isLoading);

    abortSuggestions();

    debounceTimerRef.current = setTimeout(
      () => {
        if (!isLoading && Object.keys(context.chatSuggestionConfiguration).length !== 0) {
          suggestionsAbortControllerRef.current = new AbortController();
          reloadSuggestions(
            context,
            context.chatSuggestionConfiguration,
            setCurrentSuggestions,
            suggestionsAbortControllerRef,
          );
        }
      },
      currentSuggestions.length == 0 ? 0 : SUGGESTIONS_DEBOUNCE_TIMEOUT,
    );

    return () => {
      clearTimeout(debounceTimerRef.current);
    };
  }, [isLoading, context.chatSuggestionConfiguration]);

  const sendMessage = async (messageContent: string) => {
    abortSuggestions();
    setCurrentSuggestions([]);

    const message: Message = new TextMessage({
      content: messageContent,
      role: Role.User,
    });

    if (onSubmitMessage) {
      try {
        await onSubmitMessage(messageContent);
      } catch (error) {
        console.error("Error in onSubmitMessage:", error);
      }
    }
    // this needs to happen after onSubmitMessage, because it will trigger submission
    // of the message to the endpoint. Some users depend on performing some actions
    // before the message is submitted.
    appendMessage(message);

    return message;
  };

  return {
    visibleMessages,
    isLoading,
    currentSuggestions,
    sendMessage,
    stopGeneration,
    reloadMessages,
  };
};
