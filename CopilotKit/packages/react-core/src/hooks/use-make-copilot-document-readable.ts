import { useEffect, useRef } from "react";
import { useCopilotContext } from "../context/copilot-context";
import { DocumentPointer } from "../types";

/**
 * Makes a document readable by Copilot.
 * @param document The document to make readable.
 * @param categories The categories to associate with the document.
 * @param dependencies The dependencies to use for the effect.
 * @returns The id of the document.
 */
export function useMakeCopilotDocumentReadable(
  document: DocumentPointer,
  categories?: string[],
  dependencies: any[] = [],
): string | undefined {
  const { addDocumentContext, removeDocumentContext } = useCopilotContext();
  const idRef = useRef<string>(undefined);

  useEffect(() => {
    const id = addDocumentContext(document, categories);
    idRef.current = id;

    return () => {
      removeDocumentContext(id);
    };
  }, [addDocumentContext, removeDocumentContext, ...dependencies]);

  return idRef.current;
}
