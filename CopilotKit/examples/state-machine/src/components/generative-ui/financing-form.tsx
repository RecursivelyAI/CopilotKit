import { useState } from "react";
import { AnimatedCard } from "@/components/animated-card";
import { motion, AnimatePresence } from "motion/react";
import { RenderFunctionStatus } from "@copilotkit/react-core";

interface FinancingFormProps {
  onSubmit: (creditScore: string, loanTerm: string) => void;
  status: RenderFunctionStatus;
}

export function FinancingForm({ onSubmit, status }: FinancingFormProps) {
  const [creditScore, setCreditScore] = useState("700-749");
  const [loanTerm, setLoanTerm] = useState("60");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const selectProps = (value: string, setter: (value: string) => void) => ({
    value,
    className:
      "border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none rounded-md p-2 disabled:bg-white disabled:cursor-not-allowed disabled:text-gray-500",
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setter(e.target.value),
    disabled: isSubmitted,
  });

  return (
    <AnimatedCard status={status}>
      <h1 className="text-2xl text-center font-semibold antialiased">Financing Information</h1>
      <h2 className="text-center text-base text-gray-400 antialiased">
        Please provide your financial information to process your financing application.
      </h2>
      <hr className="border-blue-300 mt-4 mb-4" />

      <select {...selectProps(creditScore, setCreditScore)}>
        <option value="750+">Excellent (750+)</option>
        <option value="700-749">Good (700-749)</option>
        <option value="650-699">Fair (650-699)</option>
        <option value="600-649">Poor (600-649)</option>
        <option value="<600">Very Poor (below 600)</option>
      </select>

      <select {...selectProps(loanTerm, setLoanTerm)}>
        <option value="36">36 Months</option>
        <option value="48">48 Months</option>
        <option value="60">60 Months</option>
        <option value="72">72 Months</option>
      </select>

      <AnimatePresence>
        {!isSubmitted && (
          <motion.button
            className="bg-blue-500 hover:bg-blue-700 transition-colors duration-300 text-white px-4 py-2 my-4 rounded-md"
            onClick={() => {
              setIsSubmitted(true);
              onSubmit(creditScore, loanTerm);
            }}
            exit={{ opacity: 0, scale: 0, height: 0, margin: 0, padding: 0 }}
            transition={{ duration: 0.3 }}
          >
            Submit
          </motion.button>
        )}
      </AnimatePresence>
    </AnimatedCard>
  );
}
