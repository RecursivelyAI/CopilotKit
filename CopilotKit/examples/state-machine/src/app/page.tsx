"use client";

import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { useStateMachine } from "@/lib/use-copilot-state-machine";

export default function Home() {
  const { make, model, year, color } = useStateMachine();

  return (
    <div className="flex h-screen w-screen items-center justify-center gap-10">
      <div className="w-[500px] h-[500px] border rounded-lg p-6 bg-white shadow-lg"> 
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Car Configuration</h2>
        <div className="space-y-4">
          <div className="border-b pb-2">
            <p className="text-sm text-gray-500">Make</p>
            <p className="text-lg font-medium">{make || 'Not selected'}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-sm text-gray-500">Model</p>
            <p className="text-lg font-medium">{model || 'Not selected'}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-sm text-gray-500">Year</p>
            <p className="text-lg font-medium">{year || 'Not selected'}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-sm text-gray-500">Color</p>
            <div className="flex items-center gap-2">
              <p className="text-lg font-medium">{color || 'Not selected'}</p>
              {color && (
                <div 
                  className="w-6 h-6 rounded-full border"
                  style={{ backgroundColor: color }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <CopilotChat 
        className="w-[500px] h-[500px] border rounded-lg p-0.5"
        instructions="You are a car configurator. You can set the make, model, year, and color of a car. Use your tools to go through the steps to configure a car. If you don't have the ability to order the car, its because the car is not configured fully yet."
      />
    </div>
  );
}
