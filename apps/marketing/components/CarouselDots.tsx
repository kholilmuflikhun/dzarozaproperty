import type { Dispatch, SetStateAction } from "react";

type Props = {
  count: number;
  active: number;
  onSelect: Dispatch<SetStateAction<number>>;
  className?: string;
};

// Titik indikator carousel dengan warna adaptif: memakai bg-white +
// mix-blend-difference sehingga otomatis menyesuaikan (tampak gelap di atas
// latar terang, tampak terang di atas latar gelap/foto) tanpa perlu prop
// warna manual di tiap komponen yang memakainya.
export default function CarouselDots({ count, active, onSelect, className = "" }: Props) {
  if (count <= 1) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`} role="group" aria-label="Navigasi slide">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Ke slide ${i + 1} dari ${count}`}
          aria-current={i === active ? "step" : undefined}
          className={`h-2 rounded-full bg-white mix-blend-difference transition-[width,opacity] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
            i === active ? "w-6 opacity-100" : "w-2 opacity-40 hover:opacity-70"
          }`}
        />
      ))}
    </div>
  );
}