import { graphql } from "../@generated/gql";
import { LangGraphInterruptEvent } from "@copilotkit/runtime/src/graphql/types/meta-events.type";

export const generateCopilotResponseMutation = graphql(/** GraphQL **/ `
  mutation generateCopilotResponse($data: GenerateCopilotResponseInput!, $properties: JSONObject) {
    generateCopilotResponse(data: $data, properties: $properties) {
      threadId
      runId
      extensions {
        openaiAssistantAPI {
          runId
          threadId
        }
      }
      ... on CopilotResponse @defer {
        status {
          ... on BaseResponseStatus {
            code
          }
          ... on FailedResponseStatus {
            reason
            details
          }
        }
      }
      messages @stream {
        __typename
        ... on BaseMessageOutput {
          id
          createdAt
        }
        ... on BaseMessageOutput @defer {
          status {
            ... on SuccessMessageStatus {
              code
            }
            ... on FailedMessageStatus {
              code
              reason
            }
            ... on PendingMessageStatus {
              code
            }
          }
        }
        ... on TextMessageOutput {
          content @stream
          role
          parentMessageId
        }
        ... on ActionExecutionMessageOutput {
          name
          arguments @stream
          parentMessageId
        }
        ... on ResultMessageOutput {
          result
          actionExecutionId
          actionName
        }
        ... on AgentStateMessageOutput {
          threadId
          state
          running
          agentName
          nodeName
          runId
          active
          role
        }
      }
      metaEvents @stream {
        ... on LangGraphInterruptEvent {
          type
          name
          value
        }
      }
    }
  }
`);
