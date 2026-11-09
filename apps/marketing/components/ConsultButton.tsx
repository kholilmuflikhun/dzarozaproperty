import WhatsAppIcon from "./WhatsAppIcon";
import { primaryWhatsApp } from "@/lib/data";

type Props = {
  serviceTitle: string;
  className?: string;
};

export default function ConsultButton({ serviceTitle, className = "" }: Props) {
  return (
    <a
      href={`https://wa.me/${primaryWhatsApp}?text=${encodeURIComponent(
        `Halo Customer Service Dzaroza Property, saya ingin konsultasi tentang layanan "${serviceTitle}".`
      )}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 py-2.5 text-sm font-semibold hover:bg-[#167F3D] hover:border-[#167F3D] transition-colors ${className}`}
    >
      <WhatsAppIcon size={16} />
      Konsultasi Layanan Ini
    </a>
  );
}