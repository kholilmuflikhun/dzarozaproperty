type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  light?: boolean;
};

export default function SectionHeading({ eyebrow, title, description, align = "left", light = false }: Props) {
  return (
    <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : "text-left"}`}>
      <span className="eyebrow">
        <span className="h-px w-6 bg-orange-500" />
        {eyebrow}
      </span>
      <h2 className={`mt-3 text-3xl sm:text-4xl font-bold tracking-tight ${light ? "text-white" : "text-charcoal-950"}`}>
        {title}
      </h2>
      {description && (
        <p className={`mt-4 text-base leading-relaxed ${light ? "text-white/70" : "text-charcoal-400"}`}>
          {description}
        </p>
      )}
    </div>
  );
}
