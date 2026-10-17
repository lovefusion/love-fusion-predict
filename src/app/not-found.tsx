import Link from "next/link";
import { Shuffle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-obsidian-900 sparkle-bg flex items-center justify-center p-4">
      <div className="text-center max-w-md animate-fade-in">
        {/* Decorative number */}
        <div className="relative mb-8">
          <p className="font-playfair text-[120px] leading-none font-bold text-gold-400/10 select-none">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-gold-400/10 border border-gold-400/20 flex items-center justify-center">
              <Shuffle className="w-8 h-8 text-gold-400/60" />
            </div>
          </div>
        </div>

        <h1 className="font-playfair text-2xl font-bold text-white mb-3">
          Page Not Found
        </h1>

        <p className="text-white/60 text-sm leading-relaxed mb-8">
          The page you're looking for doesn't exist, or your prediction link
          may have expired.
        </p>

        <Link
          href="/predict"
          className="inline-flex items-center gap-2 bg-gold-400 text-obsidian-900 font-semibold px-6 py-3 rounded-xl hover:bg-gold-300 transition-colors"
        >
          Make Your Prediction
        </Link>

        <p className="text-white/30 text-xs mt-6">
          Love Fusion Badminton League — Season 2
        </p>
      </div>
    </div>
  );
}
