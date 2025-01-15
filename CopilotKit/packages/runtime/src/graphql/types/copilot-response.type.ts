import { Field, InterfaceType, ObjectType } from "type-graphql";
import { MessageRole } from "./enums";
import { MessageStatusUnion } from "./message-status.type";
import { ResponseStatusUnion } from "./response-status.type";
import { ExtensionsResponse } from "./extensions-response.type";

@InterfaceType({
  resolveType(value) {
    if (value.hasOwnProperty("content")) {
      return TextMessageOutput;
    } else if (value.hasOwnProperty("name")) {
      return ActionExecutionMessageOutput;
    } else if (value.hasOwnProperty("result")) {
      return ResultMessageOutput;
    } else if (value.hasOwnProperty("state")) {
      return AgentStateMessageOutput;
    }
    return undefined;
  },
})
abstract class BaseMessageOutput {
  @Field(() => String)
  id: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => MessageStatusUnion)
  status: typeof MessageStatusUnion;
}

@ObjectType({ implements: BaseMessageOutput })
export class TextMessageOutput {
  @Field(() => MessageRole)
  role: MessageRole;

  @Field(() => [String])
  content: string[];

  @Field(() => String, { nullable: true })
  parentMessageId?: string;
}

@ObjectType({ implements: BaseMessageOutput })
export class ActionExecutionMessageOutput {
  @Field(() => String)
  name: string;

  @Field(() => String, {
    nullable: true,
    deprecationReason: "This field will be removed in a future version",
  })
  scope?: string;

  @Field(() => [String])
  arguments: string[];

  @Field(() => String, { nullable: true })
  parentMessageId?: string;
}

@ObjectType({ implements: BaseMessageOutput })
export class ResultMessageOutput {
  @Field(() => String)
  actionExecutionId: string;

  @Field(() => String)
  actionName: string;

  @Field(() => String)
  result: string;
}

@ObjectType({ implements: BaseMessageOutput })
export class AgentStateMessageOutput {
  @Field(() => String)
  threadId: string;

  @Field(() => String)
  agentName: string;

  @Field(() => String)
  nodeName: string;

  @Field(() => String)
  runId: string;

  @Field(() => Boolean)
  active: boolean;

  @Field(() => MessageRole)
  role: MessageRole;

  @Field(() => String)
  state: string;

  @Field(() => Boolean)
  running: boolean;
}

@ObjectType()
export class CopilotResponse {
  @Field(() => String)
  threadId!: string;

  @Field(() => ResponseStatusUnion)
  status: typeof ResponseStatusUnion;

  @Field({ nullable: true })
  runId?: string;

  @Field(() => [BaseMessageOutput])
  messages: (typeof BaseMessageOutput)[];

  @Field(() => ExtensionsResponse, { nullable: true })
  extensions?: ExtensionsResponse;
}
