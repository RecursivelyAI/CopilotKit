import { Field, InputType } from "type-graphql";
import { MetaEventName } from "../types/meta-events.type";

@InputType()
export class MetaEventInput {
  @Field(() => String)
  type: "MetaEvent" = "MetaEvent";

  @Field(() => MetaEventName)
  name: MetaEventName;

  @Field(() => String)
  value?: string;

  @Field(() => String, { nullable: true })
  response?: string;
}
