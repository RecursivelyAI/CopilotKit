/**
 * `useCopilotAdditionalInstructions` is a React hook that provides additional instructions
 * to the Copilot.
 *
 * ## Usage
 *
 * ### Simple Usage
 *
 * In its most basic usage, useCopilotAdditionalInstructions accepts a single string argument
 * representing the instructions to be added to the Copilot.
 *
 * ```tsx
 * import { useCopilotAdditionalInstructions } from "@copilotkit/react-core";
 *
 * export function MyComponent() {
 *   useCopilotAdditionalInstructions({
 *     instructions: "Do not answer questions about the weather.",
 *   });
 * }
 * ```
 *
 * ### Conditional Usage
 *
 * You can also conditionally add instructions based on the state of your app.
 *
 * ```tsx
 * import { useCopilotAdditionalInstructions } from "@copilotkit/react-core";
 *
 * export function MyComponent() {
 *   const [showInstructions, setShowInstructions] = useState(false);
 *
 *   useCopilotAdditionalInstructions({
 *     available: showInstructions ? "enabled" : "disabled",
 *     instructions: "Do not answer questions about the weather.",
 *   });
 * }
 * ```
 */
import { useEffect } from "react";
import { useCopilotContext } from "../context/copilot-context";

/**
 * Options for the useCopilotAdditionalInstructions hook.
 */
export interface UseCopilotAdditionalInstructionsOptions {
  /**
   * The instructions to be added to the Copilot. Will be added to the instructions like so:
   *
   * ```txt
   * You are a helpful assistant.
   * Additionally, follow these instructions:
   * - Do not answer questions about the weather.
   * - Do not answer questions about the stock market.
   * ```
   */
  instructions: string;

  /**
   * Whether the instructions are available to the Copilot.
   */
  available?: "enabled" | "disabled";
}

/**
 * Adds the given instructions to the Copilot context.
 */
export function useCopilotAdditionalInstructions(
  { instructions, available = "enabled" }: UseCopilotAdditionalInstructionsOptions,
  dependencies?: any[],
) {
  const { setAdditionalInstructions } = useCopilotContext();

  useEffect(() => {
    if (available === "disabled") return;

    setAdditionalInstructions((prevInstructions) => [...(prevInstructions || []), instructions]);

    return () => {
      setAdditionalInstructions(
        (prevInstructions) =>
          prevInstructions?.filter((instruction) => instruction !== instructions) || [],
      );
    };
  }, [available, instructions, setAdditionalInstructions, ...(dependencies || [])]);
}
