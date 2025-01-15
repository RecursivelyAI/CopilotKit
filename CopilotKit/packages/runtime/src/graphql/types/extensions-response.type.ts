import { Field, ObjectType } from "type-graphql";

/**
 * The extensions response is used to receive additional information from the copilot runtime, specific to a
 * service adapter or agent framework.
 *
 * Next time a request to the runtime is made, the extensions response will be included in the request as input.
 */

@ObjectType()
export class ExtensionsResponse {
  @Field(() => OpenAIApiAssistantAPIResponse, { nullable: true })
  openaiAssistantAPI?: OpenAIApiAssistantAPIResponse;
}

@ObjectType()
export class OpenAIApiAssistantAPIResponse {
  @Field(() => String, { nullable: true })
  runId?: string;

  @Field(() => String, { nullable: true })
  threadId?: string;
}
