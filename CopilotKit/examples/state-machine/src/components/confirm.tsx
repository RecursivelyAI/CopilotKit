
import { CarProps } from "@/components/car";

export interface ConfirmProps {
  args: CarProps;
  setConfirmed: (confirmed: boolean) => void;
  respond?: (result: any) => void;
  status: "executing" | "complete" | "inProgress";
}

export default function Confirm({ args, setConfirmed, respond, status }: ConfirmProps) {
  return (
    <div>
      <div className="flex flex-col gap-2 bg-gray-100 p-2 rounded-lg">
        <p>Make: {args.make}</p>
        <p>Model: {args.model}</p>
        <p>Year: {args.year}</p>
        <p>Color: {args.color}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-2">
        <button 
          disabled={status === "complete"}
          className={`bg-blue-500 text-white p-2 rounded-lg ${status === "complete" ? "opacity-50 cursor-not-allowed" : ""}`} 
          onClick={() => {
            setConfirmed(true);
            respond?.(`order the car with the following configuration: ${JSON.stringify(args)}`);
          }}
        >
          Confirm
        </button>
        <button 
          disabled={status === "complete"}
          className={`bg-red-500 text-white p-2 rounded-lg ${status === "complete" ? "opacity-50 cursor-not-allowed" : ""}`} 
          onClick={() => respond?.("cancel and reset the car")}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}