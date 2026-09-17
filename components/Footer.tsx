import Image from "next/image";
import { Instagram, Mail, MapPin } from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";
import { team, instagramAccounts, contactEmail } from "@/lib/data";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer id="kontak" className="bg-charcoal-950 text-white">
      <div className="container-content px-6 sm:px-10 lg:px-16 py-16 grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <Image
            src="/images/logo-white-1.svg"
            alt="Dzaroza Property"
            width={180}
            height={38}
            className="h-8 w-auto" />
          <p className="mt-4 text-sm text-charcoal-100/70 leading-relaxed max-w-sm">
            Managerial property & titip-jual tanah/bangunan dengan akad jelas
            di awal — transparan dan amanah, tanpa unsur gharar.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            {instagramAccounts.map((ig) => (
              <a
                key={ig.url}
                href={ig.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 w-fit rounded-full bg-white/10 pl-3 pr-4 py-2 text-sm font-medium hover:bg-orange-500 transition-colors"
                aria-label={`Instagram Dzaroza Property — ${ig.label}`}
              >
                <Instagram size={16} className="shrink-0" />
                {ig.label}
              </a>
            ))}
          </div>
      </div>

      <div>
        <h4 className="font-display text-sm font-semibold uppercase tracking-widest text-orange-500 mb-4">
          Navigasi
        </h4>
        <ul className="space-y-2.5 text-sm text-charcoal-100/70">
          <li><a href="#produk" className="hover:text-orange-400">Produk Digital</a></li>
          <li><a href="#layanan" className="hover:text-orange-400">Layanan Jasa</a></li>
          <li><a href="#portofolio" className="hover:text-orange-400">Portofolio</a></li>
          <li><a href="#testimoni" className="hover:text-orange-400">Testimoni</a></li>
          <li><a href="#profil" className="hover:text-orange-400">Company Profile</a></li>
          <li><a href="#faq" className="hover:text-orange-400">FAQ</a></li>
        </ul>
      </div>

      <div>
        <h4 className="font-display text-sm font-semibold uppercase tracking-widest text-orange-500 mb-4">
          Kontak
        </h4>
        <ul className="space-y-3 text-sm text-charcoal-100/70">
          <li className="flex items-start gap-2">
            <MapPin size={16} className="mt-0.5 shrink-0 text-orange-500" />
            Purbalingga, Jawa Tengah, Indonesia
          </li>
          <li className="flex items-start gap-2">
            <Mail size={16} className="mt-0.5 shrink-0 text-orange-500" />
            <a href={`mailto:${contactEmail}`} className="hover:text-orange-400">{contactEmail}</a>
          </li>
        </ul>
      </div>

    </div><div className="border-t border-white/10">
        <div className="container-content px-6 sm:px-10 lg:px-16 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-charcoal-100/50">
          <p>© {year} Dzaroza Property. Seluruh hak cipta dilindungi.</p>
          <div className="flex items-center gap-4">
            <a href="/privasi" className="hover:text-orange-400">Kebijakan Privasi</a>
            <p>Dibangun dengan Next.js, Tailwind CSS &amp; NextAuth.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
