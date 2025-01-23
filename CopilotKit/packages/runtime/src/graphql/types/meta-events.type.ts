import { Field, InterfaceType, ObjectType, registerEnumType } from "type-graphql";

export enum MetaEventName {
  LangGraphInterruptEvent = "LangGraphInterruptEvent",
}

registerEnumType(MetaEventName, {
  name: "MetaEventName",
  description: "Meta event types",
});

@InterfaceType()
export abstract class BaseMetaEvent {
  @Field(() => String)
  type: "MetaEvent" = "MetaEvent";

  @Field(() => MetaEventName)
  name: MetaEventName;
}

@ObjectType({ implements: BaseMetaEvent })
export class LangGraphInterruptEvent {
  @Field(() => MetaEventName)
  name: MetaEventName.LangGraphInterruptEvent = MetaEventName.LangGraphInterruptEvent;

  @Field(() => String)
  value: string;

  @Field(() => String, { nullable: true })
  response?: string;
}
