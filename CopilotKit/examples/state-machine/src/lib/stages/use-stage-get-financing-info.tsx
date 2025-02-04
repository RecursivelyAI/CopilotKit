import { FinancingForm } from "@/components/generative-ui/financing-form";
import { useGlobalState } from "@/lib/stages";
import { useCopilotAction, useCopilotAdditionalInstructions } from "@copilotkit/react-core";

/**
  useStateGetFinancingInfo is a hook that will add this stage to the state machine. It is responsible for:
  - Getting the financing information of the user.
  - Storing the financing information in the global state.
  - Moving to the next stage, confirmOrder.
*/
export function useStageGetFinancingInfo() {
  const { setFinancingInfo, stage, setStage } = useGlobalState();

  // Conditionally add additional instructions for the agent's prompt.
  useCopilotAdditionalInstructions(
    {
      instructions:
        "CURRENT STATE: You are now getting the financing information of the user. Say, 'Great! To process your financing application, I'll need some financial information from you.' and then call the 'getFinancingInformation' action.",
      available: stage === "getFinancingInfo" ? "enabled" : "disabled",
    },
    [stage],
  );

  // Render the FinancingForm component and wait for the user's response.
  useCopilotAction(
    {
      name: "getFinancingInformation",
      description: "Get the financing information of the user",
      available: stage === "getFinancingInfo" ? "enabled" : "disabled",
      renderAndWaitForResponse: ({ status, respond }) => {
        return (
          <FinancingForm
            status={status}
            onSubmit={(creditScore, loanTerm) => {
              // Store the financing information in the global state.
              setFinancingInfo({ creditScore, loanTerm });

              // Let the agent know that the user has submitted their financing information.
              respond?.("User has submitted their financing information, moving to the next state");

              // Move to the next stage, confirmOrder.
              setStage("confirmOrder");
            }}
          />
        );
      },
    },
    [stage],
  );
}
