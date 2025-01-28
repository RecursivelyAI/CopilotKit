import { ContactInfo } from "@/components/generative-ui/contact-info";
import { useGlobalState } from "@/lib/stages";
import { useCopilotAction, useCopilotAdditionalInstructions } from "@copilotkit/react-core";

export interface UseGetContactInfoStateOptions {
  enabled: boolean;
  onNextState: () => void;
}

/**
  useStateGetContactInfo is a hook that will add this stage to the state machine. It is responsible for:
  - Getting the contact information of the user.
  - Storing the contact information in the global state.
  - Moving to the next stage, buildCar.
*/
export function useStageGetContactInfo() {
  const { setContactInfo, stage, setStage } = useGlobalState();

  // Conditionally add additional instructions for the agent's prompt.
  useCopilotAdditionalInstructions(
    {
      instructions: "CURRENT STATE: You are now getting the contact information of the user.",
      available: stage === "getContactInfo" ? "enabled" : "disabled",
    },
    [stage],
  );

  // Render the ContactInfo component and wait for the user's response.
  useCopilotAction(
    {
      name: "getContactInformation",
      description: "Get the contact information of the user",
      available: stage === "getContactInfo" ? "enabled" : "disabled",
      renderAndWaitForResponse: ({ status, respond }) => {
        return (
          <ContactInfo
            status={status}
            onSubmit={(name, email, phone) => {
              // Commit the contact information to the global state.
              setContactInfo({ name, email, phone });

              // Let the agent know that the user has submitted their contact information.
              respond?.("User has submitted their contact information.");

              // This move the state machine to the next stage, buildCar deterministically.
              setStage("buildCar");
            }}
          />
        );
      },
    },
    [stage],
  );
}
