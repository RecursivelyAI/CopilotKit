import { ShowCar, ShowCars } from "@/components/generative-ui/show-car";
import { Car, cars } from "@/lib/types";
import { useGlobalState } from "@/lib/stages";
import {
  useCopilotAction,
  useCopilotReadable,
  useCopilotAdditionalInstructions,
} from "@copilotkit/react-core";

/**
  useStageBuildCar is a hook that will add this stage to the state machine. It is responsible for:
  - Helping the user select a car.
  - Storing the selected car in the global state.
  - Moving to the next stage, sellFinancing.
*/
export function useStageBuildCar() {
  const { setSelectedCar, stage, setStage } = useGlobalState();

  // Conditionally add additional instructions for the agent's prompt.
  useCopilotAdditionalInstructions(
    {
      instructions:
        "CURRENT STATE: You are now helping the user select a car. TO START, say 'Thank you for that information! What sort of car would you like to see?'. If you have a car in mind, give a reason why you recommend it and then call the 'showCar' action with the car you have in mind or show multiple cars with the 'showMultipleCars' action. Never list the cars you have in mind, just show them. Do ",
      available: stage === "buildCar" ? "enabled" : "disabled",
    },
    [stage],
  );

  // Conditionally add additional readable information for the agent's prompt.
  useCopilotReadable(
    {
      description: "Car Inventory",
      value: cars,
      available: stage === "buildCar" ? "enabled" : "disabled",
    },
    [stage],
  );

  // Conditionally add an action to show a single car.
  useCopilotAction(
    {
      name: "showCar",
      description:
        "Show a single car that you have in mind. Do not call this more than once, call `showMultipleCars` if you have multiple cars to show.",
      available: stage === "buildCar" ? "enabled" : "disabled",
      parameters: [
        {
          name: "car",
          type: "object",
          description: "The car to show",
          required: true,
          attributes: [
            { name: "id", type: "number" },
            { name: "make", type: "string" },
            { name: "model", type: "string" },
            { name: "year", type: "number" },
            { name: "color", type: "string" },
            { name: "price", type: "number" },
            {
              name: "image",
              type: "object",
              attributes: [
                { name: "src", type: "string" },
                { name: "alt", type: "string" },
                { name: "author", type: "string" },
              ],
            },
          ],
        },
      ],
      renderAndWaitForResponse: ({ args, status, respond }) => {
        const { car } = args;
        return (
          <ShowCar
            car={(car as Car) || ({} as Car)}
            status={status}
            onSelect={() => {
              // Store the selected car in the global state.
              setSelectedCar((car as Car) || ({} as Car));

              // Let the agent know that the user has selected a car.
              respond?.(
                "User has selected a car you can see it in your readables, the system will now move to the next state, do not call call nextState.",
              );

              // Move to the next stage, sellFinancing.
              setStage("sellFinancing");
            }}
            onReject={() =>
              respond?.(
                "User wants to select a different car, please stay in this state and help them select a different car",
              )
            }
          />
        );
      },
    },
    [stage],
  );

  // Conditionally add an action to show multiple cars.
  useCopilotAction(
    {
      name: "showMultipleCars",
      description:
        "Show a list of cars based on the user's query. Do not call this more than once. Call `showCar` if you only have a single car to show.",
      parameters: [
        {
          name: "cars",
          type: "object[]",
          required: true,
          attributes: [
            { name: "make", type: "string" },
            { name: "model", type: "string" },
            { name: "year", type: "number" },
            { name: "color", type: "string" },
            { name: "price", type: "number" },
            {
              name: "image",
              type: "object",
              attributes: [
                { name: "src", type: "string" },
                { name: "alt", type: "string" },
                { name: "author", type: "string" },
              ],
            },
          ],
        },
      ],
      renderAndWaitForResponse: ({ args, status, respond }) => {
        return (
          <ShowCars
            cars={(args.cars as Car[]) || ([] as Car)}
            status={status}
            onSelect={(car) => {
              // Store the selected car in the global state.
              setSelectedCar(car);

              // Let the agent know that the user has selected a car.
              respond?.(
                "User has selected a car you can see it in your readables, you are now moving to the next state",
              );

              // Move to the next stage, sellFinancing.
              setStage("sellFinancing");
            }}
          />
        );
      },
    },
    [stage],
  );
}
