import { Field, InputType } from "type-graphql";
import { MessageInput } from "./message.input";
import { FrontendInput } from "./frontend.input";
import { CloudInput } from "./cloud.input";
import { CopilotRequestType } from "../types/enums";
import { ForwardedParametersInput } from "./forwarded-parameters.input";
import { AgentSessionInput } from "./agent-session.input";
import { AgentStateInput } from "./agent-state.input";
import { ExtensionsInput } from "./extensions.input";
import { MetaEventInput } from "./meta-event.input";

@InputType()
export class GenerateCopilotResponseMetadataInput {
  @Field(() => CopilotRequestType, { nullable: true })
  requestType: CopilotRequestType;
}

@InputType()
export class GenerateCopilotResponseInput {
  @Field(() => GenerateCopilotResponseMetadataInput, { nullable: false })
  metadata: GenerateCopilotResponseMetadataInput;

  @Field(() => String, { nullable: true })
  threadId?: string;

  @Field(() => String, { nullable: true })
  runId?: string;

  @Field(() => [MessageInput])
  messages: MessageInput[];

  @Field(() => FrontendInput)
  frontend: FrontendInput;

  @Field(() => CloudInput, { nullable: true })
  cloud?: CloudInput;

  @Field(() => ForwardedParametersInput, { nullable: true })
  forwardedParameters?: ForwardedParametersInput;

  @Field(() => AgentSessionInput, { nullable: true })
  agentSession?: AgentSessionInput;

  @Field(() => AgentStateInput, { nullable: true })
  agentState?: AgentStateInput;

  @Field(() => [AgentStateInput], { nullable: true })
  agentStates?: AgentStateInput[];

  @Field(() => ExtensionsInput, { nullable: true })
  extensions?: ExtensionsInput;

  @Field(() => [MetaEventInput], { nullable: true })
  metaEvents?: MetaEventInput[];
}
