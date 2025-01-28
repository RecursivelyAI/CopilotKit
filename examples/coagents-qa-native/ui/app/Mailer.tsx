"use client";

import { useModelSelectorContext } from "@/lib/model-selector-provider";
import { useCoAgent, useCopilotAction } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";
import { useState } from "react";
import { useCopilotChatSuggestions } from "@copilotkit/react-ui";
import { useLangGraphInterrupt } from "@copilotkit/react-core";

const InterruptForm = ({ event, resolve }: { event: { value: string }, resolve: (value: string) => void }) => {
  const [name, setName] = useState<string>("");
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="text-lg font-medium">{event.value}</div>
      <input 
        type="text"
        placeholder="John Doe"
        className="border p-2 rounded"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        onClick={() => resolve(name)} 
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Submit
      </button>
    </div>
  );
};

export function Mailer() {
  const { model } = useModelSelectorContext();
  const [messageState, setMessageState] = useState<"SEND" | "CANCEL" | null>(
    null
  );

  useCopilotChatSuggestions({
    instructions: "Write an email to the CEO of OpenAI asking for a meeting",
  });

  useCoAgent({
    name: "email_agent",
    initialState: {
      model,
    },
  });

  useCopilotAction({
    name: "EmailTool",
    available: "remote",
    parameters: [
      {
        name: "the_email",
      },
    ],

    handler: async ({ the_email }) => {
      const result = window.confirm(the_email);
      const action = result ? "SEND" : "CANCEL";
      setMessageState(action);
      return action;
    },
  });

  useLangGraphInterrupt({
    render: ({ event, resolve }) => <InterruptForm event={event} resolve={resolve} />
  });

  return (
    <div
      className="flex flex-col items-center justify-center h-screen"
      data-test-id="mailer-container"
    >
      <div className="text-2xl" data-test-id="mailer-title">
        Email Q&A example
      </div>
      <div data-test-id="mailer-example">
        e.g. write an email to the CEO of OpenAI asking for a meeting
      </div>

      <CopilotPopup
        defaultOpen={true}
        clickOutsideToClose={false}
        data-test-id="mailer-popup"
      />

      <div
        data-test-id="email-success-message"
        className={messageState === "SEND" ? "" : "hidden"}
      >
        ✅ Sent email.
      </div>
      <div
        data-test-id="email-cancel-message"
        className={messageState === "CANCEL" ? "" : "hidden"}
      >
        ❌ Cancelled sending email.
      </div>
    </div>
  );
}
