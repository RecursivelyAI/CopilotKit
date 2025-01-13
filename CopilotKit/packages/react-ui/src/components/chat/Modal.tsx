import React from "react";
import { ChatContextProvider } from "./ChatContext";
import { ButtonProps, HeaderProps, WindowProps } from "./props";
import { Window as DefaultWindow } from "./Window";
import { Button as DefaultButton } from "./Button";
import { Header as DefaultHeader } from "./Header";
import { Messages as DefaultMessages } from "./Messages";
import { Input as DefaultInput } from "./Input";
import { ResponseButton as DefaultResponseButton } from "./Response";
import { CopilotChat, CopilotChatProps } from "./Chat";
import { RenderTextMessage as DefaultTextMessage } from "./messages/RenderTextMessage";
import { RenderResultMessage as DefaultResultMessage } from "./messages/RenderResultMessage";
import { RenderActionExecutionMessage as DefaultActionExecutionMessage } from "./messages/RenderActionExecutionMessage";
import { RenderAgentStateMessage as DefaultAgentStateMessage } from "./messages/RenderAgentStateMessage";

export interface CopilotModalProps extends CopilotChatProps {
  /**
   * Whether the chat window should be open by default.
   * @default false
   */
  defaultOpen?: boolean;

  /**
   * If the chat window should close when the user clicks outside of it.
   * @default true
   */
  clickOutsideToClose?: boolean;

  /**
   * If the chat window should close when the user hits the Escape key.
   * @default true
   */
  hitEscapeToClose?: boolean;

  /**
   * The shortcut key to open the chat window.
   * Uses Command-[shortcut] on a Mac and Ctrl-[shortcut] on Windows.
   * @default '/'
   */
  shortcut?: string;

  /**
   * A callback that gets called when the chat window opens or closes.
   */
  onSetOpen?: (open: boolean) => void;

  /**
   * A custom Window component to use instead of the default.
   */
  Window?: React.ComponentType<WindowProps>;

  /**
   * A custom Button component to use instead of the default.
   */
  Button?: React.ComponentType<ButtonProps>;

  /**
   * A custom Header component to use instead of the default.
   */
  Header?: React.ComponentType<HeaderProps>;
}

export const CopilotModal = ({
  instructions,
  defaultOpen = false,
  clickOutsideToClose = true,
  hitEscapeToClose = true,
  onSetOpen,
  onSubmitMessage,
  onStopGeneration,
  onReloadMessages,
  shortcut = "/",
  icons,
  labels,
  makeSystemMessage,
  showResponseButton = true,
  onInProgress,
  Window = DefaultWindow,
  Button = DefaultButton,
  Header = DefaultHeader,
  Messages = DefaultMessages,
  Input = DefaultInput,
  ResponseButton = DefaultResponseButton,
  RenderTextMessage = DefaultTextMessage,
  RenderResultMessage = DefaultResultMessage,
  RenderActionExecutionMessage = DefaultActionExecutionMessage,
  RenderAgentStateMessage = DefaultAgentStateMessage,
  className,
  children,
}: CopilotModalProps) => {
  const [openState, setOpenState] = React.useState(defaultOpen);

  const setOpen = (open: boolean) => {
    onSetOpen?.(open);
    setOpenState(open);
  };

  return (
    <ChatContextProvider icons={icons} labels={labels} open={openState} setOpen={setOpen}>
      {children}
      <div className={className}>
        <Button></Button>
        <Window
          clickOutsideToClose={clickOutsideToClose}
          shortcut={shortcut}
          hitEscapeToClose={hitEscapeToClose}
        >
          <Header />
          <CopilotChat
            instructions={instructions}
            onSubmitMessage={onSubmitMessage}
            onStopGeneration={onStopGeneration}
            onReloadMessages={onReloadMessages}
            makeSystemMessage={makeSystemMessage}
            showResponseButton={showResponseButton}
            onInProgress={onInProgress}
            Messages={Messages}
            Input={Input}
            ResponseButton={ResponseButton}
            RenderTextMessage={RenderTextMessage}
            RenderResultMessage={RenderResultMessage}
            RenderActionExecutionMessage={RenderActionExecutionMessage}
            RenderAgentStateMessage={RenderAgentStateMessage}
          />
        </Window>
      </div>
    </ChatContextProvider>
  );
};
