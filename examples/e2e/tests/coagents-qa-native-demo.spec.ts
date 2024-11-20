import { test, expect } from "@playwright/test";
import { sendChatMessage } from "../lib/helpers";
import {
  getConfigs,
  filterConfigsByProject,
  groupConfigsByDescription,
  PROJECT_NAMES,
} from "../lib/config-helper";
export const variants = [
  { name: "OpenAI", queryParams: "?coAgentsModel=openai" },
  { name: "Anthropic", queryParams: "?coAgentsModel=anthropic" },
  // { name: "Google Generative AI", value: "?coAgentsModel=google_genai" },
  // { name: "LangGraph Cloud", quaeryParams: "?lgc=true" },
];

const allConfigs = getConfigs();
const qaConfigs = filterConfigsByProject(allConfigs, PROJECT_NAMES.QA_NATIVE);
const groupedConfigs = groupConfigsByDescription(qaConfigs);

Object.entries(groupedConfigs).forEach(([projectName, descriptions]) => {
  test.describe(`${projectName}`, () => {
    Object.entries(descriptions).forEach(([description, configs]) => {
      test.describe(`${description}`, () => {
        configs.forEach((config) => {
          variants.forEach((model) => {
            test(`Test ${config.description} with variant ${model.name}`, async ({
              page,
            }) => {
              // Handle dialogs
              let isFirstDialog = true;
              page.on("dialog", (dialog) => {
                if (isFirstDialog) {
                  isFirstDialog = false;
                  dialog.dismiss();
                } else {
                  dialog.accept();
                }
              });

              // Navigate to page
              await page.goto(`${config.url}${model.queryParams}`);

              // First attempt - Cancel
              await sendChatMessage(
                page,
                "write an email to the CEO of OpenAI asking for a meeting"
              );

              const cancelMessage = page.locator(
                '[data-test-id="email-cancel-message"]'
              );
              await expect(cancelMessage).toHaveText(
                "❌ Cancelled sending email."
              );

              // Second attempt - Send
              await sendChatMessage(page, "redo");

              const successMessage = page.locator(
                '[data-test-id="email-success-message"]'
              );
              await expect(successMessage).toHaveText("✅ Sent email.");
            });
          });
        });
      });
    });
  });
});
