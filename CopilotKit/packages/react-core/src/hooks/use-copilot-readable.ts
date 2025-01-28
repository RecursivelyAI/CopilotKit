/**
 * `useCopilotReadable` is a React hook that provides app-state and other information
 * to the Copilot. Optionally, the hook can also handle hierarchical state within your
 * application, passing these parent-child relationships to the Copilot.
 *
 * ## Usage
 *
 * ### Simple Usage
 *
 * In its most basic usage, useCopilotReadable accepts a single string argument
 * representing any piece of app state, making it available for the Copilot to use
 * as context when responding to user input.
 *
 * ```tsx
 * import { useCopilotReadable } from "@copilotkit/react-core";
 *
 * export function MyComponent() {
 *   const [employees, setEmployees] = useState([]);
 *
 *   useCopilotReadable({
 *     description: "The list of employees",
 *     value: employees,
 *   });
 * }
 * ```
 *
 * ### Nested Components
 *
 * Optionally, you can maintain the hierarchical structure of information by passing
 * `parentId`. This allows you to use `useCopilotReadable` in nested components:
 *
 * ```tsx /employeeContextId/1 {17,23}
 * import { useCopilotReadable } from "@copilotkit/react-core";
 *
 * function Employee(props: EmployeeProps) {
 *   const { employeeName, workProfile, metadata } = props;
 *
 *   // propagate any information to copilot
 *   const employeeContextId = useCopilotReadable({
 *     description: "Employee name",
 *     value: employeeName
 *   });
 *
 *   // Pass a parentID to maintain a hierarchical structure.
 *   // Especially useful with child React components, list elements, etc.
 *   useCopilotReadable({
 *     description: "Work profile",
 *     value: workProfile.description(),
 *     parentId: employeeContextId
 *   });
 *
 *   useCopilotReadable({
 *     description: "Employee metadata",
 *     value: metadata.description(),
 *     parentId: employeeContextId
 *   });
 *
 *   return (
 *     // Render as usual...
 *   );
 * }
 * ```
 */
import { useEffect, useRef } from "react";
import { useCopilotContext } from "../context/copilot-context";

/**
 * Options for the useCopilotReadable hook.
 */
export interface UseCopilotReadableOptions {
  /**
   * The description of the information to be added to the Copilot context.
   */
  description: string;
  /**
   * The value to be added to the Copilot context. Object values are automatically stringified.
   */
  value: any;
  /**
   * The ID of the parent context, if any.
   */
  parentId?: string;
  /**
   * An array of categories to control which context are visible where. Particularly useful
   * with CopilotTextarea (see `useMakeAutosuggestionFunction`)
   */
  categories?: string[];

  /**
   * Whether the context is available to the Copilot.
   */
  available?: "enabled" | "disabled";

  /**
   * A custom conversion function to use to serialize the value to a string. If not provided, the value
   * will be serialized using `JSON.stringify`.
   */
  convert?: (description: string, value: any) => string;
}

function convertToJSON(description: string, value: any): string {
  return `${description}: ${typeof value === "string" ? value : JSON.stringify(value)}`;
}

/**
 * Adds the given information to the Copilot context to make it readable by Copilot.
 */
export function useCopilotReadable(
  {
    description,
    value,
    parentId,
    categories,
    convert,
    available = "enabled",
  }: UseCopilotReadableOptions,
  dependencies?: any[],
): string | undefined {
  const { addContext, removeContext } = useCopilotContext();
  const idRef = useRef<string>();
  convert = convert || convertToJSON;

  const information = convert(description, value);

  useEffect(() => {
    if (available === "disabled") return;

    const id = addContext(information, parentId, categories);
    idRef.current = id;

    return () => {
      removeContext(id);
    };
  }, [available, information, parentId, addContext, removeContext, ...(dependencies || [])]);

  return idRef.current;
}
