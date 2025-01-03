import { useEffect, useRef } from "react";
import { BaseSelection } from "slate";
import { useSlateSelector } from "slate-react";
import { Range } from "slate";
import { editorToText } from "../../lib/editor-to-text";

interface TrackerTextEditedSinceLastCursorMovementProps {
  setCursorMovedSinceLastTextChange: (value: boolean) => void;
}
export function TrackerTextEditedSinceLastCursorMovement(
  props: TrackerTextEditedSinceLastCursorMovementProps,
) {
  const cursorState: RelevantEditorState = useSlateSelector((state) => ({
    selection: state.selection,
    text: editorToText(state),
  }));

  const previousState = usePrevious(cursorState);

  useEffect(() => {
    if (!previousState) {
      return;
    }

    if (cursorChangedWithoutTextChanged(previousState, cursorState)) {
      props.setCursorMovedSinceLastTextChange(true);
    }
  }, [props.setCursorMovedSinceLastTextChange, cursorState]);

  return <></>;
}

type RelevantEditorState = {
  selection: BaseSelection;
  text: string;
};

const cursorChangedWithoutTextChanged = (
  prev: RelevantEditorState,
  next: RelevantEditorState,
): boolean => {
  // Check if the selection has changed
  const isSelectionChanged = !isSelectionEqual(prev.selection, next.selection);

  // Check if the text content remains the same
  const isTextSame = prev.text === next.text;

  return isSelectionChanged && isTextSame;
};

const isSelectionEqual = (a: BaseSelection, b: BaseSelection) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return Range.equals(a, b);
};

/**
 * Easily keep track of the *previous* value of a variable.
 *
 * Example:
 * ```
 * const [count, setCount] = useState(0);
 * const prevCount = usePrevious(count);
 *
 * useEffect(() => {
 *  if (count > prevCount) {
 *   console.log('Now I know that count is bigger than before');
 * }
 * }, [count, prevCount]);
 * ```
 */
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>(undefined);

  useEffect(() => {
    ref.current = value;
  });

  return ref.current;
}
