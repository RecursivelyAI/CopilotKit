import { cn } from "@/lib/utils/cn";
import { RenderFunctionStatus } from "@copilotkit/react-core";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";

interface AnimatedCardProps {
  children: React.ReactNode;
  status: RenderFunctionStatus;
  className?: string;
}

export function AnimatedCard({ children, className }: AnimatedCardProps) {
  const divStyles = cn(
    "flex flex-col gap-2 shadow-md shadow-blue-300/50 rounded-2xl border-2 border-blue-300 max-w-md my-4 p-8",
    className,
  );

  return (
    <AnimatePresence>
      <motion.div
        key="animated-card"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0 }}
        transition={{
          duration: 0.3,
          scale: { type: "spring", damping: 20, stiffness: 150 },
        }}
        className={divStyles}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
