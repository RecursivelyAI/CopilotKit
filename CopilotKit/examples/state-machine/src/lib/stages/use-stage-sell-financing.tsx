import { useGlobalState } from "@/lib/stages";
import {
  useCopilotAction,
  useCopilotAdditionalInstructions,
  useCopilotReadable,
} from "@copilotkit/react-core";

export interface UseStagePaymentMethodOptions {
  enabled: boolean;
  onNextState: () => void;
}

/**
  useStateSellFinancing is a hook that will add this stage to the state machine. It is responsible for:
  - Selling the financing option to the user.
  - Choosing the next stage, getFinancingInfo or getPaymentInfo, based on the user's response.
*/
export function useStageSellFinancing() {
  const { stage, setStage } = useGlobalState();

  // Conditionally add additional instructions for the agent's prompt.
  useCopilotAdditionalInstructions(
    {
      instructions:
        "CURRENT STATE: You are now trying to sell a financing option to the user. To start, ask them if they are interested in financing options and show the current promotion in a nice format. The user is not required to take the financing option, but you should try to sell it to them. Answer the user's questions call 'selectFinancing' or 'selectNoFinancing' depending on the user's response.",
      available: stage === "sellFinancing" ? "enabled" : "disabled",
    },
    [stage],
  );

  // Conditionally add additional readable information for the agent's prompt.
  useCopilotReadable(
    {
      description: "Financing Information",
      value:
        "Current promotion: 0% financing for 60 months. After 60 months, the interest rate will be 10%.",
      available: stage === "sellFinancing" ? "enabled" : "disabled",
    },
    [stage],
  );

  // Conditionally add an action to move to the getFinancingInfo stage.
  useCopilotAction(
    {
      name: "selectFinancing",
      description: "Select the financing option",
      available: stage === "sellFinancing" ? "enabled" : "disabled",
      handler: () => setStage("getFinancingInfo"),
    },
    [stage],
  );

  // Conditionally add an action to move to the getPaymentInfo stage.
  useCopilotAction(
    {
      name: "selectNoFinancing",
      description: "Select the no financing option",
      available: stage === "sellFinancing" ? "enabled" : "disabled",
      handler: () => setStage("getPaymentInfo"),
    },
    [stage],
  );
}
