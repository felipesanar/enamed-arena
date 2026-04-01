import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface FormFeedbackProps {
  tone: "error" | "success";
  message: string;
}

export function FormFeedback({ tone, message }: FormFeedbackProps) {
  const isError = tone === "error";

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={[
        "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-body-sm",
        isError
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-success/35 bg-success/10 text-success",
      ].join(" ")}
      role={isError ? "alert" : "status"}
    >
      {isError ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{message}</span>
    </motion.div>
  );
}
