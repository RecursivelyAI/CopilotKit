interface ParsedFunctionDoc {
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  returns: {
    type: string;
    description: string;
  } | null;
}
/**
 * Return an array of parameter objects from a block of text that
 * looks like a NumPy docstring parameters section.
 */
function parseParameters(rawParameters: string) {
  // Split by lines.
  const lines = rawParameters.split("\n");

  interface Param {
    name: string;
    type: string;
    description: string;
  }

  const parameters: Param[] = [];
  let currentParam: Param | null = null;

  // Regex for a parameter heading, e.g.:
  //   base_config : Optional[RunnableConfig]
  // or with indentation, e.g.:
  //     base_config : Optional[RunnableConfig]
  const paramHeadingRegex = /^[ \t]*([A-Za-z_]\w*)\s*:\s*(.*)$/;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 1) If line matches the heading format, that's a *new* parameter
    const headingMatch = line.match(paramHeadingRegex);
    if (headingMatch) {
      // If we were building a previous param, push it first
      if (currentParam) {
        parameters.push(currentParam);
      }

      // Start a new param
      const pName = headingMatch[1];
      const pType = headingMatch[2];
      currentParam = {
        name: pName.trim(),
        type: pType.trim(),
        description: "", // we’ll accumulate description lines
      };
      continue;
    }

    // 2) If it’s not a heading line and we have a current param, treat it as description
    if (currentParam && trimmedLine) {
      // Add a space if we already have some text
      if (currentParam.description.length > 0) {
        currentParam.description += " ";
      }
      currentParam.description += trimmedLine;
    }
  }

  // Push the last param if we have one
  if (currentParam) {
    parameters.push(currentParam);
  }

  return parameters;
}

/**
 * Parses out function docstrings for the given Python functions (by name).
 *
 * @param functionNames - The names of the functions to parse
 * @param fileContent - The entire Python file content
 * @returns A record where each key is a function name, and the value is the parsed doc info
 */
export function parsePythonDocstrings(
  functionNames: string[],
  fileContent: string,
): Record<string, ParsedFunctionDoc> {
  const results: Record<string, ParsedFunctionDoc> = {};

  // Regex to capture:
  // 1) Optional leading "async"
  // 2) `def`
  // 3) function name
  // 4) Anything until the `"""` docstring start
  // 5) The content inside the triple quotes
  //
  // The `[\s\S]` is used so that `.` can match newlines.
  // The `?` in `[\s\S]*?` makes it non-greedy so we capture the smallest triple-quote block.
  // The `m` flag is used so ^ can match the start of lines.
  // The `g` flag is for capturing all occurrences.
  //
  // We also add a lookbehind for ) or : to ensure we match the pattern of a function signature,
  // but you can tweak as needed.
  // Updated regex to handle multiline signatures
  const functionRegex = /\b(?:async\s+)?(def|class)\s+([A-Za-z_]\w*)[\s\S]*?"""([\s\S]*?)"""/gm;
  let match: RegExpExecArray | null;
  while ((match = functionRegex.exec(fileContent)) !== null) {
    const fnName = match[2];
    const docstring = match[3];

    // Only parse if the function is in functionNames
    if (!functionNames.includes(fnName)) {
      continue;
    }

    // 1) Split docstring by "Parameters" and/or "Returns" blocks
    //    We'll do a very naive parse in NumPy style:
    //
    //    description  (until we see the line "Parameters" or "Returns")
    //    (optional) Parameters
    //    (optional) Returns
    //
    //    Example NumPy-ish block:
    //
    //    Parameters
    //    ----------
    //    param1 : str
    //        Description...
    //    param2 : int
    //        ...
    //
    //    Returns
    //    -------
    //    int
    //        Some description...
    //
    // We'll break it up with a simple approach:
    const [rawDescription, maybeParamsAndBeyond = ""] = docstring.split(
      /\n\s*Parameters\s*[-=]+\s*\n/, // Splits after 'Parameters'
    );

    let rawParameters = "";
    let rawReturns = "";

    // Check if there's a "Returns" block in the "maybeParamsAndBeyond" chunk
    const returnsSplit = maybeParamsAndBeyond.split(/\n\s*Returns\s*[-=]+\s*\n/);
    if (returnsSplit.length === 2) {
      // [ paramsBlock, returnsBlock ]
      rawParameters = returnsSplit[0];
      rawReturns = returnsSplit[1];
    } else {
      // no Returns block found
      rawParameters = maybeParamsAndBeyond;
    }

    // 2) Parse description: everything up to "Parameters"
    const description = rawDescription.trim();

    // 3) Parse parameters from rawParameters
    const parameters = parseParameters(rawParameters);

    // 4) Parse returns from rawReturns
    //
    //    Returns
    //    -------
    //    ReturnType
    //        Description ...
    //
    // We'll do something simple: get the first line as type, the rest as the description
    let returnType = "";
    let returnDescription = "";
    if (rawReturns.trim()) {
      // The first non-empty line is the type
      const lines = rawReturns.split("\n").map((l) => l.trim());
      returnType = lines[0];
      // The rest is the description
      returnDescription = lines.slice(1).join(" ");
    }

    results[fnName] = {
      description,
      parameters,
      returns: returnType ? { type: returnType, description: returnDescription.trim() } : null,
    };
  }

  return results;
}
