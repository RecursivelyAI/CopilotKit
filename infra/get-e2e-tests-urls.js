const fs = require("fs");
const path = require("path");

const file = fs.readFileSync(
  path.resolve(__dirname, "./cdk_outputs.json"),
  "utf8"
);

function generateTable() {
  const json = JSON.parse(file);
  const e2eUrls = {};

  // Group entries by ProjectName
  Object.values(json).forEach((value) => {
    if (value.EndToEndProjectKey) {
      e2eUrls[value.EndToEndProjectKey] = {
        url: value.FunctionUrl,
        description: value.ProjectDescription,
      };
    }
  }, {});

  console.log(JSON.stringify(e2eUrls, null, 2));
}

generateTable();
