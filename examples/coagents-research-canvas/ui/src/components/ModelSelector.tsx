"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModelSelectorContext } from "@/lib/model-selector-provider";

export function ModelSelector() {
  const { model, setModel } = useModelSelectorContext();

  return (
    <div className="fixed bottom-0 left-0 p-4 z-50">
      <Select value={model} onValueChange={(v) => setModel(v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="openai">OpenAI</SelectItem>
          <SelectItem value="anthropic">Anthropic</SelectItem>
          <SelectItem value="google_genai">Google Generative AI</SelectItem>
          <SelectItem value="crewai">CrewAI</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
