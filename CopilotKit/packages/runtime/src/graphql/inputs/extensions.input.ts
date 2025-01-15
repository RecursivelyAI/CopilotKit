import { Field, InputType } from "type-graphql";

/**
 * The extensions input is used to pass additional information to the copilot runtime, specific to a
 * service adapter or agent framework.
 */

@InputType()
export class ExtensionsInput {
  @Field(() => OpenAIApiAssistantAPIInput, { nullable: true })
  openaiAssistantAPI?: OpenAIApiAssistantAPIInput;
}

@InputType()
export class OpenAIApiAssistantAPIInput {
  @Field(() => String, { nullable: true })
  runId?: string;

  @Field(() => String, { nullable: true })
  threadId?: string;
}
