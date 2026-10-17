/**
 * /live — Broadcast Display (16:9)
 *
 * Designed for projection. Auto-refreshes every 30 seconds.
 * Shows: live entry count, group predictions leaderboard, no PII.
 */

import type { Metadata } from "next";
import { LiveBroadcastClient } from "./LiveBroadcastClient";

export const metadata: Metadata = {
  title: "Live Display — Love Fusion Badminton League",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function LivePage() {
  return <LiveBroadcastClient />;
}
