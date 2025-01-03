import { RenderElementProps } from "slate-react";
import { JSX } from "react";

export type RenderElementFunction = (props: RenderElementProps) => JSX.Element;

export function makeRenderElementFunction(
  suggestionsStyle: React.CSSProperties,
): RenderElementFunction {
  return (props: RenderElementProps) => {
    switch (props.element.type) {
      case "paragraph":
        return <DefaultElement {...props} />;
      case "suggestion":
        return <SuggestionElement {...props} suggestionsStyle={suggestionsStyle} />;
    }
  };
}

const DefaultElement = (props: RenderElementProps) => {
  return <div {...props.attributes}>{props.children}</div>;
};
const SuggestionElement = (
  props: RenderElementProps & {
    suggestionsStyle: React.CSSProperties;
  },
) => {
  return (
    <span
      {...props.attributes}
      style={{
        ...props.suggestionsStyle,
      }}
      data-testid="suggestion"
      contentEditable={false}
    >
      {props.children /* https://github.com/ianstormtaylor/slate/issues/3930 */}
      {props.element.type === "suggestion" && props.element.content}
    </span>
  );
};
