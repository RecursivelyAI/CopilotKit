import useAutosizeTextArea from "../../../hooks/misc/use-autosize-textarea";
import {
  EditingEditorState,
  Generator_InsertionOrEditingSuggestion,
} from "../../../types/base/autosuggestions-bare-function";
import { SourceSearchBox } from "../../source-search-box/source-search-box";
import { DocumentPointer, useCopilotContext } from "@copilotkit/react-core";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { RefObject, useCallback, useEffect, useRef, useState } from "react";

import { streamPromiseFlatten } from "../../../lib/stream-promise-flatten";
import { IncludedFilesPreview } from "./included-files-preview";
import { useHoveringEditorContext } from "../hovering-editor-provider";

export type SuggestionState = {
  editorState: EditingEditorState;
};

export interface HoveringInsertionPromptBoxCoreProps {
  state: SuggestionState;
  performInsertion: (insertedText: string) => void;
  insertionOrEditingFunction: Generator_InsertionOrEditingSuggestion;
  contextCategories: string[];
}

export const HoveringInsertionPromptBoxCore = ({
  performInsertion,
  state,
  insertionOrEditingFunction,
  contextCategories,
}: HoveringInsertionPromptBoxCoreProps) => {
  const { getDocumentsContext } = useCopilotContext();

  const [editSuggestion, setEditSuggestion] = useState<string>("");
  const [suggestionIsLoading, setSuggestionIsLoading] = useState<boolean>(false);

  const [adjustmentPrompt, setAdjustmentPrompt] = useState<string>("");

  const [generatingSuggestion, setGeneratingSuggestion] = useState<ReadableStream<string> | null>(
    null,
  );

  const adjustmentTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionTextAreaRef = useRef<HTMLTextAreaElement>(null);

  const [filePointers, setFilePointers] = useState<DocumentPointer[]>([]);

  const [suggestedFiles, setSuggestedFiles] = useState<DocumentPointer[]>([]);
  useEffect(() => {
    setSuggestedFiles(getDocumentsContext(contextCategories));
  }, [contextCategories, getDocumentsContext]);

  useAutosizeTextArea(suggestionTextAreaRef as RefObject<HTMLTextAreaElement>, editSuggestion || "");
  useAutosizeTextArea(adjustmentTextAreaRef as RefObject<HTMLTextAreaElement>, adjustmentPrompt || "");

  // initially focus on the adjustment prompt text area
  useEffect(() => {
    adjustmentTextAreaRef.current?.focus();
  }, []);

  // continuously read the generating suggestion stream and update the edit suggestion
  useEffect(() => {
    // if no generating suggestion, do nothing
    if (!generatingSuggestion) {
      return;
    }

    // Check if the stream is already locked (i.e. already reading from it)
    if (generatingSuggestion.locked) {
      return;
    }

    // reset the edit suggestion
    setEditSuggestion("");

    // read the generating suggestion stream and continuously update the edit suggestion
    const reader = generatingSuggestion.getReader();
    const read = async () => {
      setSuggestionIsLoading(true);
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        setEditSuggestion((prev) => {
          const newSuggestion = prev + value;

          // Scroll to the bottom of the textarea. We call this here to make sure scroll-to-bottom is synchronous with the state update.
          if (suggestionTextAreaRef.current) {
            suggestionTextAreaRef.current.scrollTop = suggestionTextAreaRef.current.scrollHeight;
          }
          return newSuggestion;
        });
      }

      setSuggestionIsLoading(false);
    };
    read();

    return () => {
      // release the lock if the reader is not closed on unmount
      const releaseLockIfNotClosed = async () => {
        try {
          await reader.closed;
        } catch {
          reader.releaseLock();
        }
      };

      releaseLockIfNotClosed();
    };
  }, [generatingSuggestion]);

  // generate an adjustment to the completed text, based on the adjustment prompt
  const beginGeneratingAdjustment = useCallback(async () => {
    // don't generate text if the prompt is empty
    if (!adjustmentPrompt.trim()) {
      return;
    }

    // editor state includes the text being edited, and the text before/after the selection
    // if the current edit suggestion is not empty, then use *it* as the "selected text" - instead of the editor state's selected text
    let modificationState = state.editorState;
    if (editSuggestion !== "") {
      modificationState.selectedText = editSuggestion;
    }

    // generate the adjustment suggestion
    const adjustmentSuggestionTextStreamPromise = insertionOrEditingFunction(
      modificationState,
      adjustmentPrompt,
      filePointers,
      new AbortController().signal,
    );
    const adjustmentSuggestionTextStream = streamPromiseFlatten(
      adjustmentSuggestionTextStreamPromise,
    );

    setGeneratingSuggestion(adjustmentSuggestionTextStream);
  }, [
    adjustmentPrompt,
    editSuggestion,
    state.editorState,
    insertionOrEditingFunction,
    filePointers,
  ]);

  const isLoading = suggestionIsLoading;

  const textToEdit = editSuggestion || state.editorState.selectedText;
  const adjustmentLabel =
    textToEdit === ""
      ? "Describe the text you want to insert"
      : "Describe adjustments to the suggested text";
  const placeholder =
    textToEdit === ""
      ? "e.g. 'summarize the client's top 3 pain-points from @CallTranscript'"
      : "e.g. 'make it more formal', 'be more specific', ...";

  const { setIsDisplayed } = useHoveringEditorContext();

  const AdjustmentPromptComponent = (
    <>
      <Label className="">{adjustmentLabel}</Label>
      <div className="relative w-full flex items-center">
        <textarea
          data-testid="adjustment-prompt"
          disabled={suggestionIsLoading}
          ref={adjustmentTextAreaRef}
          value={adjustmentPrompt}
          onChange={(e) => setAdjustmentPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.shiftKey) {
              e.preventDefault();
              setAdjustmentPrompt(adjustmentPrompt + "\n");
            } else if (e.key === "Enter") {
              e.preventDefault();
              beginGeneratingAdjustment();
            } else if (e.key == "Escape") {
              e.preventDefault();
              setIsDisplayed(false);
            }
          }}
          placeholder={placeholder}
          style={{ minHeight: "3rem" }}
          className="w-full bg-slate-100 h-auto h-min-14 text-sm p-2 rounded-md resize-none overflow-visible focus:outline-none focus:ring-0 focus:border-non pr-[3rem]"
          rows={1}
        />
        <button
          onClick={beginGeneratingAdjustment}
          className="absolute right-2 bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center"
          data-testid="generate-button"
        >
          <i className="material-icons">arrow_forward</i>
        </button>
      </div>
    </>
  );

  const SuggestionComponent = (
    <>
      <div className="flex justify-between items-end w-full">
        <Label className="mt-4">Suggested:</Label>
        <div className="ml-auto">
          {isLoading && (
            <div className="flex justify-center items-center">
              <div
                className="inline-block h-4 w-4 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                role="status"
              >
                <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
                  Loading...
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      <textarea
        data-testid="suggestion-result"
        ref={suggestionTextAreaRef}
        value={editSuggestion}
        disabled={suggestionIsLoading}
        onChange={(e) => setEditSuggestion(e.target.value)}
        className="w-full text-base p-2 border border-gray-300 rounded-md resize-none bg-green-50"
        style={{ overflow: "auto", maxHeight: "10em" }}
      />
    </>
  );

  const SubmitComponent = (
    <div className="flex w-full gap-4 justify-start">
      <Button
        data-testid="insert-button"
        className=" bg-green-700 text-white"
        onClick={() => {
          performInsertion(editSuggestion);
        }}
      >
        Insert <i className="material-icons">check</i>
      </Button>
    </div>
  );

  // show source search if the last word in the adjustment prompt BEGINS with an @
  const sourceSearchCandidate = adjustmentPrompt.split(" ").pop();
  // if the candidate is @someCandidate, then 'someCandidate', otherwise undefined
  const sourceSearchWord = sourceSearchCandidate?.startsWith("@")
    ? sourceSearchCandidate.slice(1)
    : undefined;

  return (
    <div className="w-full flex flex-col items-start relative gap-2">
      {AdjustmentPromptComponent}
      {filePointers.length > 0 && (
        <IncludedFilesPreview includedFiles={filePointers} setIncludedFiles={setFilePointers} />
      )}
      {sourceSearchWord !== undefined && (
        <SourceSearchBox
          searchTerm={sourceSearchWord}
          suggestedFiles={suggestedFiles}
          onSelectedFile={(filePointer) => {
            setAdjustmentPrompt(adjustmentPrompt.replace(new RegExp(`@${sourceSearchWord}$`), ""));
            setFilePointers((prev) => [...prev, filePointer]);

            // focus back on the adjustment prompt, and move the cursor to the end
            adjustmentTextAreaRef.current?.focus();
          }}
        />
      )}
      {generatingSuggestion ? SuggestionComponent : null}
      {generatingSuggestion ? SubmitComponent : null}
    </div>
  );
};
