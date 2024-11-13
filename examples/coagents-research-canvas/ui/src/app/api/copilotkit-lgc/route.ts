import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import OpenAI from "openai";
import { NextRequest } from "next/server";
import { langGraphCloudEndpoint } from "@copilotkit/runtime";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const llmAdapter = new OpenAIAdapter({ openai });

const deploymentUrl = process.env.LGC_DEPLOYMENT_URL as string
const langsmithApiKey = process.env.LANGSMITH_API_KEY as string

const runtime = new CopilotRuntime({
  remoteEndpoints: [
    langGraphCloudEndpoint({
      deploymentUrl,
      langsmithApiKey,
      agents: [{
        name: 'research_agent',
        description: 'Research agent',
      }, {
        name: 'research_agent_google_genai',
        description: 'Research agent',
      }],
    }),
  ],
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: llmAdapter,
    endpoint: "/api/copilotkit-lgc",
  });

  return handleRequest(req);
};