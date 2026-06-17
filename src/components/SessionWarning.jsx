import React from "react";
import { Clock } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function SessionWarning() {
  const { sessionTimer } = useAuth();
  const { timeRemaining, showWarning, formatTimeRemaining } = sessionTimer;

  if (!showWarning || timeRemaining === null) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-secondary-50 border border-secondary-200 p-4 rounded-xl shadow-lg max-w-sm">
      <div className="flex items-start gap-3">
        <Clock className="h-5 w-5 text-secondary-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-secondary-900">
            Demo time running low
          </h3>
          <p className="mt-1 text-sm text-secondary-700">
            About <strong>{formatTimeRemaining(timeRemaining)}</strong> left today.
            Resets at midnight UTC.
          </p>
        </div>
      </div>
    </div>
  );
}
