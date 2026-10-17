/**
 * /entry/[token] — Private participant entry receipt + score view.
 *
 * Accessed via the privateToken embedded in the confirmation URL.
 * Shows the entry, predictions, and (if scored) the group scores + prize.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { EntryReceiptView } from "@/lib/types";
import { EntryReceiptClient } from "./EntryReceiptClient";

export const metadata: Metadata = {
  title: "Your Entry — Love Fusion Badminton League",
  robots: { index: false, follow: false },  // private page
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: { token: string };
}

async function fetchEntry(token: string): Promise<EntryReceiptView | null> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res  = await fetch(`${base}/api/entry/${token}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function EntryPage({ params }: PageProps) {
  const { token } = params;

  if (!token || token.length !== 48) {
    notFound();
  }

  const entry = await fetchEntry(token);
  if (!entry) {
    notFound();
  }

  return <EntryReceiptClient entry={entry} />;
}
