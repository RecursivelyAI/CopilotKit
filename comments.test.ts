import * as ts from "typescript";
import { Comments } from "./Comments"; // Adjust the import path as necessary

describe("Comments Class", () => {
  const sourceCode = `
    /**
     * This is a sample function.
     * @param x The first parameter.
     * @param y The second parameter.
     * @default 0
     * @returns The sum of x and y.
     */
    function add(x: number, y: number): number {
      return x + y;
    }
  `;

  const sourceFile = ts.createSourceFile("test.ts", sourceCode, ts.ScriptTarget.Latest);

  test("getCleanedCommentsForNode", () => {
    const functionNode = sourceFile.statements[0]; // Get the function node
    const comments = Comments.getCleanedCommentsForNode(functionNode, sourceFile);
    expect(comments).toBe("This is a sample function.\n");
  });

  test("getDefaultValueForNode", () => {
    const functionNode = sourceFile.statements[0];
    const defaultValue = Comments.getDefaultValueForNode(functionNode, sourceFile);
    expect(defaultValue).toBe("0");
  });

  test("getTsDocCommentsForFunction", () => {
    const functionNode = sourceFile.statements[0];
    const { comment, params } = Comments.getTsDocCommentsForFunction(functionNode, sourceFile);
    expect(comment).toBe("This is a sample function.");
    expect(params).toEqual({
      x: "The first parameter.",
      y: "The second parameter."
    });
  });
});
