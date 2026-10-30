"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import CarouselDots from "./CarouselDots";
import Lightbox from "./Lightbox";
import { useColumns } from "@/lib/useColumns";
import { team, type TeamMember } from "@/lib/data";

// Tim sampai 4 orang ditampilkan sebagai grid biasa. Begitu anggota lebih dari
// 4, tampilan otomatis berubah menjadi carousel — tanpa perlu mengubah kode.
const MAX_MEMBERS_WITHOUT_CAROUSEL = 4;

// Lebar kartu mengikuti jumlah kolom tiap breakpoint (1 / 2 / 4 kolom, jarak
// gap-6 = 1.5rem). Dipakai flex-wrap + justify-center supaya jumlah anggota
// yang sedikit (1-3 orang) atau halaman carousel terakhir tetap rapi di tengah
// dengan ukuran kartu yang sama.
const CARD_WIDTH = "w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)]";

const SWIPE_THRESHOLD = 40; // px minimal geser supaya dianggap swipe, bukan tap

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function MemberCard({ member, onOpen }: { member: TeamMember; onOpen: (member: TeamMember) => void }) {
  return (
    <div
      className={`${CARD_WIDTH} overflow-hidden rounded-xl2 border border-white/10 bg-white/5 transition-colors hover:border-orange-500/50`}
    >
      {member.photo ? (
        <button
          type="button"
          onClick={() => onOpen(member)}
          aria-label={`Perbesar foto ${member.name}`}
          className="relative block aspect-square w-full"
        >
          <Image
            src={member.photo}
            alt={member.name}
            fill
            draggable={false}
            unoptimized={member.photo.endsWith(".svg")}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover object-top"
          />
        </button>
      ) : (
        <div
          aria-hidden="true"
          className="flex aspect-square w-full items-center justify-center bg-charcoal-800 font-display text-5xl font-bold text-orange-400"
        >
          {initials(member.name)}
        </div>
      )}
      <div className="p-5">
        <p className="text-base font-bold">{member.name}</p>
        <p className="mt-1 text-xs text-white/60">{member.role}</p>
      </div>
    </div>
  );
}

export default function TeamSection() {
  const [active, setActive] = useState<TeamMember | null>(null);
  const [page, setPage] = useState(0);
  const columns = useColumns({ base: 1, sm: 2, lg: 4 });
  const isCarousel = team.length > MAX_MEMBERS_WITHOUT_CAROUSEL;

  const pages = useMemo(() => {
    const chunks: TeamMember[][] = [];
    for (let i = 0; i < team.length; i += columns) {
      chunks.push(team.slice(i, i + columns));
    }
    return chunks.length ? chunks : [[]];
  }, [columns]);

  // Kembali ke halaman pertama kalau jumlah kolom berubah (mis. resize layar).
  useEffect(() => {
    setPage(0);
  }, [columns]);

  const safePage = Math.min(page, pages.length - 1);
  const currentItems = pages[safePage] ?? [];
  const canPrev = safePage > 0;
  const canNext = safePage < pages.length - 1;

  // Swipe untuk pindah halaman. Class touch-pan-y di container membuat gerak
  // horizontal dikirim ke Pointer Events, sedangkan scroll vertikal halaman
  // tetap berjalan normal.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    swipeStart.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!swipeStart.current) return;
    const deltaX = e.clientX - swipeStart.current.x;
    const deltaY = e.clientY - swipeStart.current.y;
    swipeStart.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX < 0 && canNext) setPage(safePage + 1);
    else if (deltaX > 0 && canPrev) setPage(safePage - 1);
  }

  function handlePointerCancel() {
    swipeStart.current = null;
  }

  const lightbox = active?.photo ? (
    <Lightbox
      images={[active.photo]}
      alt={active.name}
      title={active.name}
      subtitle={active.role}
      onClose={() => setActive(null)}
    />
  ) : null;

  if (!isCarousel) {
    return (
      <>
        <div className="flex flex-wrap justify-center gap-6">
          {team.map((member) => (
            <MemberCard key={member.id} member={member} onOpen={setActive} />
          ))}
        </div>
        {lightbox}
      </>
    );
  }

  return (
    <>
      <div className="relative">
        <div
          key={safePage}
          className="flex animate-fade-in touch-pan-y flex-wrap justify-center gap-6"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {currentItems.map((member) => (
            <MemberCard key={member.id} member={member} onOpen={setActive} />
          ))}
        </div>

        {pages.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => canPrev && setPage(safePage - 1)}
              disabled={!canPrev}
              aria-label="Anggota tim sebelumnya"
              className="absolute left-0 top-1/2 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-charcoal-900 text-white shadow-card transition-colors hover:border-orange-400 disabled:opacity-30 lg:flex"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => canNext && setPage(safePage + 1)}
              disabled={!canNext}
              aria-label="Anggota tim berikutnya"
              className="absolute right-0 top-1/2 hidden h-11 w-11 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-charcoal-900 text-white shadow-card transition-colors hover:border-orange-400 disabled:opacity-30 lg:flex"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {pages.length > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => canPrev && setPage(safePage - 1)}
            disabled={!canPrev}
            aria-label="Anggota tim sebelumnya"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white disabled:opacity-30 lg:hidden"
          >
            <ChevronLeft size={16} />
          </button>

          <CarouselDots count={pages.length} active={safePage} onSelect={setPage} />

          <button
            type="button"
            onClick={() => canNext && setPage(safePage + 1)}
            disabled={!canNext}
            aria-label="Anggota tim berikutnya"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white disabled:opacity-30 lg:hidden"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {lightbox}
    </>
  );
}