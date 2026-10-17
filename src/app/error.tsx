"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error tracking in production
    console.error("[AppError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-obsidian-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-red-900/30 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>

        <h1 className="font-playfair text-2xl font-bold text-white mb-3">
          Something went wrong
        </h1>

        <p className="text-white/60 text-sm leading-relaxed mb-2">
          An unexpected error occurred. Please try again.
        </p>

        {error.digest && (
          <p className="text-white/30 text-xs font-mono mb-6">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex gap-3 justify-center mt-6">
          <Button variant="gold" size="md" onClick={reset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => (window.location.href = "/predict")}
          >
            Go to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
