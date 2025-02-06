"use client";

import { useCopilotAction } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";
import { useState } from "react";

export default function Home() {
  return (
    <>
      <YourMainContent />
      <CopilotPopup
        defaultOpen={true}
        labels={{
          title: "Popup Assistant",
          initial: "Need any help?",
        }}
      />
    </>
  );
}

function YourMainContent() {
  const [backgroundColor, setBackgroundColor] = useState("#ADD8E6");
  useCopilotAction({
    name: "greet_user",
    available: "disabled",
    parameters: [
      {
        name: "name",
        description: "The name of the user to greet.",
      },
    ],
    render: ({ args, result, status }) => {
      return (
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 border-b" colSpan={2}>
                greet_user called
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-2 border-b">args</td>
              <td className="px-4 py-2 border-b">{JSON.stringify(args)}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 border-b">result</td>
              <td className="px-4 py-2 border-b">{result}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 border-b">status</td>
              <td className="px-4 py-2 border-b">{status}</td>
            </tr>
          </tbody>
        </table>
      );
    },
  });
  useCopilotAction({
    name: "setBackgroundColor",
    parameters: [
      {
        name: "backgroundColor",
        description:
          "The background color to set. Make sure to pick nice colors.",
      },
    ],
    handler({ backgroundColor }) {
      setBackgroundColor(backgroundColor);
    },
  });

  return (
    <div
      style={{ backgroundColor }}
      className="h-screen w-screen flex justify-center items-center text-2xl"
    >
      Your main content
    </div>
  );
}
