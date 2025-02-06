import { test, expect } from "@playwright/test";
import {
  waitForStepsAndEnsureStreaming,
  waitForResponse,
  sendChatMessage,
  waitForSuggestions,
} from "../lib/helpers";
import {
  getConfigs,
  filterConfigsByProject,
  groupConfigsByDescription,
  PROJECT_NAMES,
  TestVariants,
} from "../lib/config-helper";

const variants: TestVariants = [
  { name: "OpenAI", queryParams: "?coAgentsModel=openai" },
  { name: "Anthropic", queryParams: "?coAgentsModel=anthropic" },
  { name: "CrewAI", queryParams: "?coAgentsModel=crewai" },
];

// Get configurations
const allConfigs = getConfigs();
const researchCanvasConfigs = filterConfigsByProject(
  allConfigs,
  PROJECT_NAMES.COAGENTS_RESEARCH_CANVAS
);
const groupedConfigs = groupConfigsByDescription(researchCanvasConfigs);

const cloudVariants = variants.filter((variant) => variant.isCloud);
const nonCloudVariants = variants.filter((variant) => !variant.isCloud);

test.describe.configure({ mode: "parallel" });

Object.entries(groupedConfigs).forEach(([projectName, descriptions]) => {
  test.describe(`${projectName}`, () => {
    Object.entries(descriptions).forEach(([description, configs]) => {
      test.describe(`${description}`, () => {
        configs.forEach((config) => {
          const groups: Record<string, TestVariants> = {
            "FastAPI Python": nonCloudVariants,
            "Copilot Cloud": cloudVariants,
          };

          if (config.lgcPythonDeploymentUrl) {
            groups["LGC Python in-memory"] = nonCloudVariants.map(
              (variant) => ({
                ...variant,
                name: `${variant.name} (LGC Python in-memory)`,
                queryParams: `${variant.queryParams}&lgcDeploymentUrl=${config.lgcPythonDeploymentUrl}`,
              })
            );
          }

          if (config.lgcJSDeploymentUrl) {
            groups["LGC JS in-memory"] = nonCloudVariants.map((variant) => ({
              ...variant,
              name: `${variant.name} (LGC JS in-memory)`,
              queryParams: `${variant.queryParams}&lgcDeploymentUrl=${config.lgcJSDeploymentUrl}`,
            }));
          }

          Object.entries(groups).forEach(([groupName, variants]) => {
            test.describe(`${groupName}`, () => {
              test.describe.configure({ mode: "serial" });
              variants.forEach((variant) => {
                test(`Test ${config.description} with variant ${variant.name}`, async ({
                  page,
                }) => {
                  await page.goto(`${config.url}${variant.queryParams}`);
                  await waitForSuggestions(page);
                  const researchQuestion = "Lifespan of penguins";
                  await page
                    .getByPlaceholder("Enter your research question")
                    .fill(researchQuestion);

                  await sendChatMessage(
                    page,
                    "Conduct research based on my research question, please. DO NOT FORGET TO PRODUCE THE DRAFT AT THE END!"
                  );

                  await waitForStepsAndEnsureStreaming(page);

                  await waitForResponse(page);

                  // Ensure research draft
                  const researchDraft = await page.locator(
                    '[data-test-id="research-draft"]'
                  );
                  const draftContent = await researchDraft.textContent();

                  try {
                    expect(draftContent).not.toBe("");
                  } catch (e) {
                    // Sometimes the LLM does not fill the draft. We will attempt a retry at filling it.
                    await sendChatMessage(
                      page,
                      "The draft seems to be empty, please fill it in."
                    );
                    await waitForStepsAndEnsureStreaming(page);
                    await waitForResponse(page);

                    const draftContent = await researchDraft.textContent();
                    expect(draftContent).not.toBe("");
                  }

                  const resourceCount = await page
                    .locator('[data-test-id="resource"]')
                    .count();

                  await page.waitForTimeout(5000);

                  await sendChatMessage(
                    page,
                    `Delete the first resource, please`
                  );

                  const deleteContainer = await page.locator(
                    '[data-test-id="delete-resource-generative-ui-container"]'
                  );
                  expect(deleteContainer).toBeTruthy();

                  await page.locator('button:has-text("Delete")').click();
                  await waitForResponse(page);

                  const newResourceCount = await page
                    .locator('[data-test-id="resource"]')
                    .count();
                  expect(newResourceCount).toBe(resourceCount - 1);
                });
              });
            });
          });
        });
      });
    });
  });
});
