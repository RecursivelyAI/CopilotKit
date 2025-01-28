import { test, expect } from "@playwright/test";
import { sendChatMessage } from "../lib/helpers";
import {
  getConfigs,
  filterConfigsByProject,
  groupConfigsByDescription,
  PROJECT_NAMES,
  TestVariants,
  appendLGCVariants,
} from "../lib/config-helper";

const variants: TestVariants = [
  { name: "OpenAI", queryParams: "?coAgentsModel=openai" },
  { name: "Anthropic", queryParams: "?coAgentsModel=anthropic" },
  // { name: "Google Generative AI", queryParams: "?coAgentsModel=google_genai" }, // seems broken
];

const allConfigs = getConfigs();
const qaConfigs = filterConfigsByProject(
  allConfigs,
  PROJECT_NAMES.COAGENTS_QA_NATIVE
);
const groupedConfigs = groupConfigsByDescription(qaConfigs);

Object.entries(groupedConfigs).forEach(([projectName, descriptions]) => {
  test.describe(`${projectName}`, () => {
    Object.entries(descriptions).forEach(([description, configs]) => {
      test.describe(`${description}`, () => {
        configs.forEach((config) => {
          appendLGCVariants(
            {
              ...config,
            },
            variants
          ).forEach((variant) => {
            test(`Test ${config.description} with variant ${variant.name}`, async ({
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
              await page.goto(`${config.url}${variant.queryParams}`);

              // First attempt - Cancel
              await sendChatMessage(
                page,
                "write an email to the CEO of OpenAI asking for a meeting"
              );

              // First interaction will bring up interrupt interface
              await page
                  .getByPlaceholder("Enter your name")
                  .fill('CopilotKit Automation');
              await page.locator('button:has-text("Submit")').click();

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
