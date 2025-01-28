"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import {
  useStageBuildCar,
  useStageGetContactInfo,
  useStageGetPaymentInfo,
  useStageConfirmOrder,
  useStageSellFinancing,
  useStageGetFinancingInfo,
} from "@/lib/stages";

import { useCopilotChat } from "@copilotkit/react-core";
import { TextMessage, MessageRole } from "@copilotkit/runtime-client-gql";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

export interface ChatProps {
  className?: string;
}

export function CarSalesChat({ className }: ChatProps) {
  const { appendMessage, isLoading } = useCopilotChat();
  const [initialMessageSent, setInitialMessageSent] = useState(false);

  // Add the stages of the state machine
  useStageGetContactInfo();
  useStageBuildCar();
  useStageSellFinancing();
  useStageGetPaymentInfo();
  useStageGetFinancingInfo();
  useStageConfirmOrder();

  // Render an initial message when the chat is first loaded
  useEffect(() => {
    if (initialMessageSent || isLoading) return;

    setTimeout(() => {
      appendMessage(
        new TextMessage({
          content:
            "Hi, I'm Fio, your AI car salesman. First, let's get your contact information before we get started.",
          role: MessageRole.Assistant,
        }),
      );
      setInitialMessageSent(true);
    }, 500);
  }, [initialMessageSent, appendMessage, isLoading]);

  return (
    <div
      className={cn(
        "flex flex-col h-full max-h-full justify-center items-center h-full w-full rounded-2xl border border-blue-300 shadow-lg",
        className,
      )}
    >
      <CopilotChat
        className="overflow-y-auto w-full h-full rounded-2xl"
        instructions={systemPrompt}
      />
    </div>
  );
}

const systemPrompt = `
GOAL
You are trying to help the user purchase a car. The user will be going through a series of stages to accomplish this goal. Please help
them through the process with their tools and data keeping in mind the current stage of the interaction. Do not proceed to the next
stage until the current stage is complete. You must take each stage one at a time, do not skip any stages.

BACKGROUND
You are built by CopilotKit, an open-source framework for building agentic applications.

DETAILS
You will be going through a series of stages to sell a car. Each stage will have its own unique instructions, tools and data. Please evaluate your current stage
before responding. Any additional instructions provided in the stage should be followed with the highest priority. DO NOT RESPOND WITH DATA YOU DO NOT HAVE ACCESS TO.
If you cannot perform an action, do not attempt to perform it, just let the know that they cannot do that and reiterate the instructions for the current stage.

NOTICES
- DO NOT mention the word "stage" or "state" in your responses.
- DO NOT mention the word "state machine" in your responses.
- DO NOT offer to let the user test drive the car.
`;
