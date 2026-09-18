type Props = {
  count: number;
  active: number;
  onSelect: (index: number) => void;
  className?: string;
};

// Titik indikator carousel dengan warna adaptif: memakai bg-white +
// mix-blend-difference sehingga otomatis menyesuaikan (tampak gelap di atas
// latar terang, tampak terang di atas latar gelap/foto) tanpa perlu prop
// warna manual di tiap komponen yang memakainya.
export default function CarouselDots({ count, active, onSelect, className = "" }: Props) {
  if (count <= 1) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Ke slide ${i + 1}`}
          aria-current={i === active}
          className={`h-2 rounded-full bg-white mix-blend-difference transition-all ${
            i === active ? "w-6 opacity-100" : "w-2 opacity-40 hover:opacity-70"
          }`}
        />
      ))}
    </div>
  );
}