"use client";

import { useEffect, useState } from "react";

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number } | null;

function getTimeLeft(target: string): TimeLeft {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

type Props = {
  releaseDate: string;
  className?: string;
};

export default function CountdownTimer({ releaseDate, className = "" }: Props) {
  // Mulai dari null di server & client (menghindari hydration mismatch),
  // baru dihitung sungguhan setelah mount lewat useEffect (client-only).
  const [time, setTime] = useState<TimeLeft>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTime(getTimeLeft(releaseDate));
    const id = setInterval(() => setTime(getTimeLeft(releaseDate)), 1000);
    return () => clearInterval(id);
  }, [releaseDate]);

  if (!mounted) {
    return <div className={`h-16 ${className}`} aria-hidden="true" />;
  }

  if (!time) {
    return <p className={`text-sm font-semibold text-orange-700 ${className}`}>Segera dirilis!</p>;
  }

  const units = [
    { label: "Hari", value: time.days },
    { label: "Jam", value: time.hours },
    { label: "Menit", value: time.minutes },
    { label: "Detik", value: time.seconds },
  ];

  return (
    <div className={`flex justify-center gap-2.5 ${className}`}>
      {units.map((u) => (
        <div
          key={u.label}
          className="flex min-w-[54px] flex-col items-center rounded-lg bg-charcoal-950 px-3 py-2 text-white"
        >
          <span className="font-display text-lg font-bold tabular-nums">
            {String(u.value).padStart(2, "0")}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-white/60">{u.label}</span>
        </div>
      ))}
    </div>
  );
}
