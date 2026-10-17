import type { Metadata } from "next";
import { PredictClientPage } from "./PredictClientPage";

export const metadata: Metadata = {
  title: "Predict the Top 2 — Love Fusion Badminton League",
  description:
    "Enter your predictions for the top 2 qualifiers from each group. Win ₹11,000 if you get all 4 groups right!",
};

// Revalidate every 60 seconds so deadline changes propagate quickly
export const revalidate = 60;

export default function PredictPage() {
  return <PredictClientPage />;
}
