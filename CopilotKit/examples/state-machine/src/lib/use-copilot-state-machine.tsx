"use client";

import { createContext, useContext, ReactNode, useState } from "react";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { availableCars } from "./available-cars";
import Confirm from "@/components/confirm";
import { CarProps } from "@/components/car";

type StateMachineContextType = {
  make: string;
  setMake: (make: string) => void;
  model: string;
  setModel: (model: string) => void;
  year: string;
  setYear: (year: string) => void;
  color: string;
  setColor: (color: string) => void;
};

const StateMachineContext = createContext<StateMachineContextType | undefined>(undefined);

export const StateMachineProvider = ({ children }: { children: ReactNode }) => {
  const [make, setMake] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [color, setColor] = useState<string>("");
  const [confirmed, setConfirmed] = useState<boolean>(false);

  useCopilotReadable({
    description: "Available cars",
    value: availableCars,
  });

  useCopilotReadable({
    description: "A car",
    value: {
      make,
      model,
      year,
      color,
    },
  });

  useCopilotAction({
    name: "make",
    available: make ? "disabled" : "enabled",
    parameters: [{ name: "make", type: "string", description: "The make of the car", required: true }],
    handler: ({make}) => setMake(make),
  });

  useCopilotAction({
    name: "model",
    available: model ? "disabled" : "enabled",
    parameters: [{ name: "model", type: "string", description: "The model of the car", required: true }],
    handler: ({model}) => setModel(model),
  });

  useCopilotAction({  
    name: "year",
    available: year ? "disabled" : "enabled",
    parameters: [{ name: "year", type: "string", description: "The year of the car", required: true }],
    handler: ({year}) => setYear(year),
  });

  useCopilotAction({  
    name: "color",
    available: color ? "disabled" : "enabled",
    parameters: [{ name: "color", type: "string", description: "The color of the car", required: true }],
    handler: ({color}) => setColor(color),
  });

  useCopilotAction({
    name: "reset",
    available: make && model && year && color ? "enabled" : "disabled",
    handler: () => {
      setMake("");
      setModel("");
      setYear("");
      setColor("");
    },
  });

  useCopilotAction({
    name: "confirmUserResponse",
    description: "Confirm the car configuration",
    parameters: [
      { name: "make", type: "string", description: "The make of the car", required: true },
      { name: "model", type: "string", description: "The model of the car", required: true },
      { name: "year", type: "string", description: "The year of the car", required: true },
      { name: "color", type: "string", description: "The color of the car", required: true },
    ],
    available: make && model && year && color ? "enabled" : "disabled",
    renderAndWaitForResponse: ({args, status, respond}) => {
      return <Confirm 
        args={args as CarProps} 
        setConfirmed={setConfirmed} 
        respond={respond} 
        status={status}
      />;
    },
  });

  useCopilotAction({
    name: "orderCar",
    available: confirmed ? "enabled" : "disabled",
    handler: () => {
      alert("Car ordered!");
      setConfirmed(false);
      setMake("");
      setModel("");
      setYear("");
      setColor("");
    },
  });

  return (
    <StateMachineContext.Provider value={{ 
      make,
      setMake,
      model,
      setModel,
      year,
      setYear,
      color,
      setColor,
    }}>
      {children}
    </StateMachineContext.Provider>
  );
};

export const useStateMachine = () => {
  const context = useContext(StateMachineContext);
  if (context === undefined) {
    throw new Error("useStateMachine must be used within a StateMachineProvider");
  }
  return context;
}; 