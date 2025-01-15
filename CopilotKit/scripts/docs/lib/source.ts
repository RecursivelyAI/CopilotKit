import * as ts from "typescript";
// @ts-ignore
import * as fs from "fs";
// @ts-ignore
import { existsSync } from "fs";
// @ts-ignore
import { dirname, resolve } from "path";
import { Comments } from "./comments";

export interface InterfaceDefinition {
  name: string;
  properties: {
    name: string;
    type: string;
    required: boolean;
    comment: string;
    defaultValue?: string;
  }[];
}

export interface MethodDefinition {
  signature: string;
  comment: string;
  parameters: {
    name: string;
    type: string;
    required: boolean;
    comment: string;
  }[];
}

export class SourceFile {
  public sourceFile!: ts.SourceFile;

  constructor(private readonly filePath: string) {}

  parse() {
    const fileContents = fs.readFileSync(this.filePath, "utf8");
    this.sourceFile = ts.createSourceFile(
      this.filePath,
      fileContents,
      ts.ScriptTarget.Latest,
      true,
    );
  }

  /**
   * Get the interface definition of the first argument of the function or class constructor.
   */
  getArg0Interface(name: string): InterfaceDefinition | null {
    let interfaceName: string = "";

    const visit = (node: ts.Node) => {
      // if we find a matching function declaration
      if (
        ts.isFunctionDeclaration(node) &&
        node.name?.getText() === name &&
        node.parameters.length &&
        node.parameters[0].type &&
        ts.isTypeReferenceNode(node.parameters[0].type)
      ) {
        interfaceName = node.parameters[0].type.typeName.getText();
      }
      // if we find a matching class declaration
      else if (ts.isClassDeclaration(node) && node.name?.getText() === name) {
        const constructor = node.members.find((member) =>
          ts.isConstructorDeclaration(member),
        ) as ts.ConstructorDeclaration;
        if (
          constructor &&
          constructor.parameters.length &&
          constructor.parameters[0].type &&
          ts.isTypeReferenceNode(constructor.parameters[0].type)
        ) {
          interfaceName = constructor.parameters[0].type.typeName.getText();
        }
      }
      // if we find a matching forwardRef declaration
      else if (ts.isVariableStatement(node) || ts.isVariableDeclaration(node)) {
        const declarations = ts.isVariableStatement(node)
          ? node.declarationList.declarations
          : [node];

        declarations.forEach((declaration) => {
          if (
            ts.isVariableDeclaration(declaration) &&
            declaration.name.getText() === name &&
            declaration.initializer &&
            ts.isCallExpression(declaration.initializer) &&
            declaration.initializer.expression.getText() === "React.forwardRef"
          ) {
            const func = declaration.initializer.arguments[0];
            if (
              ts.isArrowFunction(func) &&
              func.parameters.length &&
              func.parameters[0].type &&
              ts.isTypeReferenceNode(func.parameters[0].type)
            ) {
              interfaceName = func.parameters[0].type.typeName.getText();
            }
          }
        });
      }

      ts.forEachChild(node, visit);
    };

    // analyze the source file
    visit(this.sourceFile);

    if (!interfaceName) {
      return null;
    }

    // extract the interface definition
    let interfaceFilePath = this.findTypeDeclaration(interfaceName) || this.filePath;

    const interfaceSource = new SourceFile(interfaceFilePath);
    interfaceSource.parse();

    return interfaceSource.extractInterfaceDefinition(interfaceName);
  }

  /**
   * Extracts the interface definition from the source file.
   */
  protected extractInterfaceDefinition(interfaceName: string): InterfaceDefinition {
    const definition: InterfaceDefinition = {
      name: interfaceName,
      properties: [],
    };
    const visit = (node: ts.Node) => {
      if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
        let omittedProperties: Set<string> = new Set();

        // Check for extended interfaces
        if (node.heritageClauses && node.heritageClauses.length > 0) {
          const firstClause = node.heritageClauses[0];
          firstClause.types.forEach((type) => {
            const typeName = type.expression.getText(this.sourceFile);
            let extendedInterfaceName = typeName;

            // Check if the type is an Omit
            if (typeName.startsWith("Omit")) {
              const omitArgs = type.typeArguments;
              if (omitArgs && omitArgs.length > 0) {
                extendedInterfaceName = omitArgs[0].getText(this.sourceFile);
                if (omitArgs.length > 1) {
                  const omittedProps = omitArgs[1];
                  if (ts.isUnionTypeNode(omittedProps)) {
                    omittedProps.types.forEach((prop) => {
                      omittedProperties.add(prop.getText(this.sourceFile).replace(/['"]/g, ""));
                    });
                  } else if (ts.isLiteralTypeNode(omittedProps)) {
                    omittedProperties.add(
                      omittedProps.getText(this.sourceFile).replace(/['"]/g, ""),
                    );
                  }
                }
              }
            }

            const extendedInterfaceFilePath = this.findTypeDeclaration(extendedInterfaceName);
            if (extendedInterfaceFilePath) {
              // Parse the extended interface file and extract its definition
              const extendedInterfaceSource = new SourceFile(extendedInterfaceFilePath);
              extendedInterfaceSource.parse();
              const extendedDefinition =
                extendedInterfaceSource.extractInterfaceDefinition(extendedInterfaceName);
              // Merge properties from the extended interface, excluding omitted properties
              extendedDefinition.properties.forEach((prop) => {
                if (!omittedProperties.has(prop.name)) {
                  definition.properties.push(prop);
                }
              });
            }
          });
        }
        node.members.forEach((member) => {
          if (ts.isPropertySignature(member)) {
            const propertyName = member.name.getText(this.sourceFile);
            const comment = Comments.getCleanedCommentsForNode(member, this.sourceFile);
            const defaultValue = Comments.getDefaultValueForNode(member, this.sourceFile);

            definition.properties.push({
              name: propertyName,
              type: (member.type?.getText(this.sourceFile) || "unknown")
                .replace(/\n/g, "")
                .replace(/\s+/g, " "),
              required: !member.questionToken,
              comment,
              defaultValue,
            });
          }
        });
      }
      ts.forEachChild(node, visit);
    };

    visit(this.sourceFile);
    return definition;
  }

  /**
   * Finds the absolute declaration file path of a type if imported.
   */
  findTypeDeclaration(typeName: string): string | null {
    for (const statement of this.sourceFile.statements) {
      if (ts.isImportDeclaration(statement) && statement.importClause) {
        const namedBindings = statement.importClause.namedBindings;
        if (namedBindings && ts.isNamedImports(namedBindings)) {
          const imports = namedBindings.elements.filter(
            (element) => element.name.text === typeName,
          );
          if (imports.length > 0) {
            const moduleSpecifier = (statement.moduleSpecifier as ts.StringLiteral).text;
            // Resolve the path relative to the directory of the current source file
            let resolvedPath = resolve(dirname(this.sourceFile.fileName), moduleSpecifier);

            if (existsSync(resolvedPath + ".ts")) {
              return resolvedPath + ".ts";
            } else if (existsSync(resolvedPath + ".tsx")) {
              return resolvedPath + ".tsx";
            }
            return null;
          }
        }
      }
    }
    return null;
  }

  /**
   * Get the public method definitions of a class.
   */
  getPublicMethodDefinitions(className: string): MethodDefinition[] {
    const methodDefinitions: MethodDefinition[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && node.name?.getText() === className) {
        node.members.forEach((member) => {
          if (
            ts.isMethodDeclaration(member) &&
            member.modifiers?.every((modifier) => modifier.kind !== ts.SyntaxKind.PrivateKeyword)
          ) {
            methodDefinitions.push(this.extractMethodDefinition(member));
          }
        });
      }
      ts.forEachChild(node, visit);
    };

    visit(this.sourceFile);

    return methodDefinitions;
  }

  /**
   * Extracts the method definition from a method declaration.
   */
  private extractMethodDefinition(member: ts.MethodDeclaration): MethodDefinition {
    const functionComments = Comments.getTsDocCommentsForFunction(member, this.sourceFile);
    const name = ts.isConstructorDeclaration(member) ? "constructor" : member.name.getText();
    let signature = name + "(" + member.parameters.map((param) => param.getText()).join(", ") + ")";
    signature = signature.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return {
      signature,
      comment: functionComments.comment,
      parameters: member.parameters.map((param) => {
        return {
          name: param.name.getText(),
          type: param.type?.getText() || "unknown",
          required: !param.questionToken,
          comment: functionComments.params[param.name.getText()] || "",
        };
      }),
    };
  }

  /**
   * Get the constructor definition of a class.
   */
  getConstructorDefinition(className: string): MethodDefinition | null {
    let constructorDefinition: MethodDefinition | null = null;

    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && node.name?.getText() === className) {
        const constr = node.members.find((member) => ts.isConstructorDeclaration(member)) as any;
        if (constr) {
          constructorDefinition = this.extractMethodDefinition(constr);
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(this.sourceFile);

    return constructorDefinition;
  }

  /**
   * Get the block comment preceding a function definition.
   */
  getFunctionComment(functionName: string): string | null {
    let functionComment: string | null = null;

    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.getText() === functionName) {
        functionComment = Comments.getCleanedCommentsForNode(node, this.sourceFile);
      }
      ts.forEachChild(node, visit);
    };

    visit(this.sourceFile);

    return functionComment;
  }

  /**
   * Get the arguments of a function by its name.
   */
  getFunctionArguments(functionName: string): Array<{
    name: string;
    type: string;
    required: boolean;
    defaultValue: string;
    description: string;
  }> | null {
    let functionArguments: Array<{
      name: string;
      type: string;
      required: boolean;
      defaultValue: string;
      description: string;
    }> | null = null;

    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.getText() === functionName) {
        functionArguments = node.parameters.map((param) => {
          const name = param.name.getText();
          const type = param.type?.getText() || "unknown";
          const required = !param.questionToken;
          const defaultValue = param.initializer ? param.initializer.getText() : "";

          // Use the comment cleaning method
          const description = Comments.getCleanedCommentsForNode(param, this.sourceFile);

          return { name, type, required, defaultValue, description };
        });
      }
      ts.forEachChild(node, visit);
    };

    visit(this.sourceFile);

    return functionArguments;
  }
}
