import React, { useCallback } from "react";
import { GraphQLError } from "@copilotkit/runtime-client-gql";
import { useToast } from "../toast/toast-provider";
import { ExclamationMarkIcon } from "../toast/exclamation-mark-icon";
import { ERROR_NAMES } from "@copilotkit/shared";
import { CopilotKitError } from "@copilotkit/shared/src";

interface OriginalError {
  message?: string;
  stack?: string;
}

export function ErrorToast({ errors }: { errors: (Error | GraphQLError)[] }) {
  const errorsToRender = errors.map((error, idx) => {
    const originalError =
      "extensions" in error ? (error.extensions?.originalError as undefined | OriginalError) : {};
    const message = originalError?.message ?? error.message;
    const code = "extensions" in error ? (error.extensions?.code as string) : null;

    const cpkError =
      // @ts-expect-error -- name is not one of possible keys
      "extensions" in error && Object.values(ERROR_NAMES).includes(error.extensions.name)
        ? error.extensions
        : null;

    return (
      <div
        key={idx}
        style={{
          marginTop: idx === 0 ? 0 : 10,
          marginBottom: 14,
        }}
      >
        <ExclamationMarkIcon style={{ marginBottom: 4 }} />

        {code && (
          <div
            style={{
              fontWeight: "600",
              marginBottom: 4,
            }}
          >
            Copilot Cloud Error:{" "}
            <span style={{ fontFamily: "monospace", fontWeight: "normal" }}>{code}</span>
          </div>
        )}
        {cpkError ? (
          <>
            <div style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: message || "" }} />
            <a href={cpkError.troubleshootingUrl as string} style={{ textDecoration: "underline" }}>
              Learn More
            </a>
          </>
        ) : (
          <div>{message}</div>
        )}
      </div>
    );
  });
  return (
    <div
      style={{
        fontSize: "13px",
        maxWidth: "600px",
      }}
    >
      {errorsToRender}
      <div style={{ fontSize: "11px", opacity: 0.75 }}>
        NOTE: This error only displays during local development.
      </div>
    </div>
  );
}

export function useErrorToast() {
  const { addToast } = useToast();

  return useCallback(
    (error: (Error | GraphQLError)[]) => {
      const errorId = error
        .map((err) => {
          const message =
            "extensions" in err
              ? (err.extensions?.originalError as any)?.message || err.message
              : err.message;
          const stack = err.stack || "";
          return btoa(message + stack).slice(0, 32); // Create hash from message + stack
        })
        .join("|");

      addToast({
        type: "error",
        id: errorId, // Toast libraries typically dedupe by id
        message: <ErrorToast errors={error} />,
      });
    },
    [addToast],
  );
}

export function useAsyncCallback<T extends (...args: any[]) => Promise<any>>(
  callback: T,
  deps: Parameters<typeof useCallback>[1],
) {
  const addErrorToast = useErrorToast();
  return useCallback(async (...args: Parameters<T>) => {
    try {
      return await callback(...args);
    } catch (error) {
      console.error("Error in async callback:", error);
      // @ts-ignore
      addErrorToast([error]);
      throw error;
    }
  }, deps);
}
