import { useGlobalState } from "@/lib/stages";
import { Car, CardInfo, ContactInfo, FinancingInfo, Order } from "@/lib/types";
import { ConfirmOrder } from "@/components/generative-ui/confirm-order";

import { useCopilotAction, useCopilotAdditionalInstructions } from "@copilotkit/react-core";

/**
  useStageConfirmOrder is a hook that will add this stage to the state machine. It is responsible for:
  - Confirming the order of the user.
  - Storing the order in the global state.
  - Optionally, can decide to move to the next stage, buildCar, based on the user's responses.
*/
export function useStageConfirmOrder() {
  const { setOrders, stage, setStage } = useGlobalState();

  // Conditionally add additional instructions for the agent's prompt.
  useCopilotAdditionalInstructions(
    {
      instructions:
        "CURRENT STATE: You are now confirming the order of the user. Say, 'Great! Now let's just confirm your order. Here is the summary of your order. ' and then call the 'confirmOrder' action. Instead of giving a summary in text you should instead use the 'confirmOrder' action.",
      available: stage === "confirmOrder" ? "enabled" : "disabled",
    },
    [stage],
  );

  // Conditionally add the nextState action to the state machine. Agent will decide if it should be called.
  useCopilotAction(
    {
      name: "nextState",
      description: "Proceed to next state",
      available: stage === "confirmOrder" ? "enabled" : "disabled",
      handler: async () => setStage("getContactInfo"),
    },
    [stage],
  );

  // Render the ConfirmOrder component and wait for the user's response.
  useCopilotAction(
    {
      name: "confirmOrder",
      description: "Confirm the order of the user",
      available: stage === "confirmOrder" ? "enabled" : "disabled",
      renderAndWaitForResponse: ({ status, respond }) => {
        return (
          <ConfirmOrder
            status={status}
            onConfirm={(order: Order) => {
              // Commit the order to the global state.
              setOrders((prevOrders) => [...prevOrders, order]);

              // Let the agent know that the user has confirmed their order.
              respond?.(
                "User confirmed their order, please ask them if they would like to place a another order and if they do, call the 'nextState' action.",
              );
            }}
            onCancel={() => {
              // Let the agent know that the user has cancelled their order.
              respond?.(
                "User cancelled their order, please ask them if they'd like to start over with a new order or if they'd like to continue with their current order. If they'd like to start over, call the 'nextState' action. If they'd like to continue with their current order, call the 'confirmOrder' action.",
              );
            }}
          />
        );
      },
    },
    [stage],
  );
}
