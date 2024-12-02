import { test, expect } from "@playwright/test";
import { waitForResponse, sendChatMessage } from "../lib/helpers";
import {
  getConfigs,
  filterConfigsByProject,
  groupConfigsByDescription,
  PROJECT_NAMES,
} from "../lib/config-helper";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const variants = [
  { name: "OpenAI", queryParams: "?coAgentsModel=openai" },
  { name: "Anthropic", queryParams: "?coAgentsModel=anthropic" },
  { name: "Google Generative AI", queryParams: "?coAgentsModel=google_genai" },
  {
    name: "LangChain (OpenAI)",
    queryParams: "?coAgentsModel=langchain_openai",
  },
  {
    name: "LangChain (Anthropic)",
    queryParams: "?coAgentsModel=langchain_anthropic",
  },
  {
    name: "LangChain (Gemini)",
    queryParams: "?coAgentsModel=langchain_gemini",
  },
  { name: "Groq", queryParams: "?coAgentsModel=groq" },
];

if (
  process.env.COPILOT_CLOUD_PROD_RUNTIME_URL &&
  process.env.COPILOT_CLOUD_PROD_PUBLIC_API_KEY
) {
  const runtimeUrl = process.env.COPILOT_CLOUD_PROD_RUNTIME_URL;
  const publicApiKey = process.env.COPILOT_CLOUD_PROD_PUBLIC_API_KEY;
  variants.push({
    name: "Copilot Cloud (Production)",
    queryParams: `?runtimeUrl=${runtimeUrl}&publicApiKey=${publicApiKey}`,
  });
}

if (
  process.env.COPILOT_CLOUD_STAGING_RUNTIME_URL &&
  process.env.COPILOT_CLOUD_STAGING_PUBLIC_API_KEY
) {
  const runtimeUrl = process.env.COPILOT_CLOUD_STAGING_RUNTIME_URL;
  const publicApiKey = process.env.COPILOT_CLOUD_STAGING_PUBLIC_API_KEY;
  variants.push({
    name: "Copilot Cloud (Staging)",
    queryParams: `?runtimeUrl=${runtimeUrl}&publicApiKey=${publicApiKey}`,
  });
}

// Get configurations
const allConfigs = getConfigs();
const researchCanvasConfigs = filterConfigsByProject(
  allConfigs,
  PROJECT_NAMES.COPILOTKIT_NEXT_OPENAI
);
const groupedConfigs = groupConfigsByDescription(researchCanvasConfigs);

Object.entries(groupedConfigs).forEach(([projectName, descriptions]) => {
  test.describe(`${projectName}`, () => {
    Object.entries(descriptions).forEach(([description, configs]) => {
      test.describe(`${description}`, () => {
        configs.forEach((config) => {
          test.describe(`WaterBnB Demo ("/" route)`, () => {
            variants.forEach((variant) => {
              test(`Test ${config.description} with variant ${variant.name}`, async ({
                page,
              }) => {
                await page.goto(`${config.url}${variant.queryParams}`);

                const getDestinationCheckbox = ({
                  destination,
                  isChecked,
                }: {
                  destination: string;
                  isChecked: boolean;
                }) =>
                  page.locator(
                    `[data-test-id="checkbox-${destination}-${
                      isChecked ? "checked" : "unchecked"
                    }"]`
                  );

                // Open Copilot Sidebar
                await page.click('[aria-label="Open Chat"]');
                await page.waitForTimeout(500);

                // First, we expect the destinations to be unchecked
                await expect(
                  getDestinationCheckbox({
                    destination: "new-york-city",
                    isChecked: false,
                  })
                ).toBeVisible();
                await expect(
                  getDestinationCheckbox({
                    destination: "tokyo",
                    isChecked: false,
                  })
                ).toBeVisible();

                // Next, we ask AI to select the destinations
                await sendChatMessage(
                  page,
                  "Select New York City and Tokyo as destinations."
                );
                await waitForResponse(page);

                // Finally, we expect the destinations to be checked
                await expect(
                  getDestinationCheckbox({
                    destination: "new-york-city",
                    isChecked: true,
                  })
                ).toBeVisible();
                await expect(
                  getDestinationCheckbox({
                    destination: "tokyo",
                    isChecked: true,
                  })
                ).toBeVisible();

                // Ask to deselect Tokyo
                await sendChatMessage(
                  page,
                  "Actually, please deselect New York City."
                );
                await waitForResponse(page);

                // Validate
                await expect(
                  getDestinationCheckbox({
                    destination: "new-york-city",
                    isChecked: false,
                  })
                ).toBeVisible();
                await expect(
                  getDestinationCheckbox({
                    destination: "tokyo",
                    isChecked: true,
                  })
                ).toBeVisible();
              });
            });
          });

          test.describe(`Textarea Demo ("/textarea" route)`, () => {
            variants.forEach((variant) => {
              test(`Test ${config.description} with variant ${variant.name}`, async ({
                page,
              }) => {
                console.log("1. Going to textarea page");
                await page.goto(`${config.url}/textarea${variant.queryParams}`);
                
                console.log("2. Clicking textarea");
                await page.getByTestId("copilot-textarea-editable").click();
                
                console.log("3. Typing initial text");
                await page.keyboard.type("Hello, CopilotKit!", { delay: 25 });
                
                console.log("4. Checking suggestion not visible");
                expect(page.getByTestId("suggestion")).not.toBeVisible();
                
                console.log("5. Waiting for suggestion to appear");
                await page.waitForSelector("[data-testid='suggestion']", {
                  state: "visible",
                });
                
                console.log("6. Getting suggestion text");
                const suggestion = await page
                  .getByTestId("suggestion")
                  .textContent();
              
                console.log("7. Pressing Tab to accept suggestion");
                await page.keyboard.press("Tab");
              
                console.log("8. Getting post-completion content");
                const contentPostCompletion = await page
                  .getByTestId("copilot-textarea-editable")
                  .textContent();
                
                console.log("9. Validating completion");
                expect(
                  contentPostCompletion?.trim().endsWith(suggestion!.trim())
                ).toBe(true);
              
                console.log("10. Selecting all text");
                await page.keyboard.press("ControlOrMeta+A");
                
                console.log("11. Waiting after selection");
                await page.waitForTimeout(500);
              
                console.log("12. Opening command menu");
                await page.keyboard.down("ControlOrMeta");
                await page.keyboard.down("KeyK");
                
                console.log("13. Waiting for menu");
                await page.waitForSelector("[data-testid='menu']", {
                  state: "visible",
                });
                
                console.log("14. Releasing command keys");
                await page.keyboard.up("KeyK");
                await page.keyboard.up("ControlOrMeta");
              
                console.log("15. Typing command");
                await page.keyboard.type("Make it shorter", { delay: 25 });
                
                console.log("16. Pressing Enter");
                await page.keyboard.press("Enter");
              
                console.log("17. Waiting for suggestion result");
                await page.waitForSelector("[data-testid='suggestion-result']", {
                  state: "visible",
                });
                
                console.log("18. Waiting for insert button");
                await page.waitForSelector("[data-testid='insert-button']", {
                  state: "visible",
                });
                
                console.log("19. Waiting before clicking insert");
                await page.waitForTimeout(500);
                
                console.log("20. Clicking insert button");
                await page.getByTestId("insert-button").click();
              
                console.log("21. Getting final content");
                const contentPostReplace = await page
                  .getByTestId("copilot-textarea-editable")
                  .textContent();
                
                console.log("22. Validating content changed");
                expect(contentPostReplace?.trim()).not.toBe(
                  contentPostCompletion?.trim()
                );
              });
            });
          });
        });
      });
    });
  });
});
