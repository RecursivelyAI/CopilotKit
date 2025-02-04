import { useState } from "react";
import { AnimatedCard } from "@/components/animated-card";
import { motion, AnimatePresence } from "motion/react";

import { RenderFunctionStatus } from "@copilotkit/react-core";

interface ContactInfoProps {
  onSubmit: (name: string, email: string, phone: string) => void;
  status: RenderFunctionStatus;
}

export function ContactInfo({ onSubmit, status }: ContactInfoProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const inputProps = (value: string, setter: (value: string) => void) => ({
    value,
    className:
      "border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none rounded-md p-2 disabled:bg-white disabled:cursor-not-allowed disabled:text-gray-500",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setter(e.target.value),
    disabled: isSubmitted,
  });

  return (
    <AnimatedCard status={status}>
      <h1 className="text-2xl text-center font-semibold antialiased">Contact Information</h1>
      <h2 className="text-center text-base text-gray-400 antialiased">
        We need this information in order to process your order and contact you if there are any
        issues.
      </h2>
      <hr className="border-blue-300 mt-4 mb-4" />

      <input type="text" placeholder="Name" {...inputProps(name, setName)} />
      <input type="email" placeholder="Email" {...inputProps(email, setEmail)} />
      <input type="tel" placeholder="Phone" {...inputProps(phone, setPhone)} />

      <AnimatePresence>
        {!isSubmitted && (
          <motion.button
            className="bg-blue-500 hover:bg-blue-700 transition-colors duration-300 text-white px-4 py-2 my-4 rounded-md"
            onClick={() => {
              setIsSubmitted(true);
              onSubmit(name, email, phone);
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
