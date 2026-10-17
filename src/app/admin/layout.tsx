import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Love Fusion Predict",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-obsidian-900">
      {children}
    </div>
  );
}
