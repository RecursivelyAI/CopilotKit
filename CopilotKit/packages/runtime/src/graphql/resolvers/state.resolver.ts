import { Arg, Resolver } from "type-graphql";
import { Ctx } from "type-graphql";
import { Query } from "type-graphql";
import { LoadAgentStateResponse } from "../types/load-agent-state-response.type";
import type { GraphQLContext } from "../../lib/integrations";
import { LoadAgentStateInput } from "../inputs/load-agent-state.input";

@Resolver(() => LoadAgentStateResponse)
export class StateResolver {
  @Query(() => LoadAgentStateResponse)
  async loadAgentState(@Ctx() ctx: GraphQLContext, @Arg("data") data: LoadAgentStateInput) {
    const agents = await ctx._copilotkit.runtime.discoverAgentsFromEndpoints(ctx);
    const agent = agents.find((agent) => agent.name === data.agentName);

    if (!agent) {
      return {
        threadId: data.threadId,
        threadExists: false,
        state: JSON.stringify({}),
        messages: JSON.stringify([]),
      };
    }

    const state = await ctx._copilotkit.runtime.loadAgentState(ctx, data.threadId, data.agentName);

    return state;
  }
}
