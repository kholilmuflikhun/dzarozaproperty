"use client";

import { useEffect, useState } from "react";

type ColumnBreakpoints = {
  base?: number; // < 640px
  sm?: number; // >= 640px
  lg?: number; // >= 1024px
};

// Mendeteksi jumlah kolom grid aktif sesuai breakpoint Tailwind yang dipakai
// (grid sm:grid-cols-{sm} lg:grid-cols-{lg}), supaya paginasi/carousel dihitung
// benar di tiap ukuran layar — mobile, tablet, desktop.
export function useColumns({ base = 1, sm = 2, lg = 3 }: ColumnBreakpoints = {}) {
  const [columns, setColumns] = useState(base);

  useEffect(() => {
    const mqLg = window.matchMedia("(min-width: 1024px)");
    const mqSm = window.matchMedia("(min-width: 640px)");

    function update() {
      if (mqLg.matches) setColumns(lg);
      else if (mqSm.matches) setColumns(sm);
      else setColumns(base);
    }

    update();
    mqLg.addEventListener("change", update);
    mqSm.addEventListener("change", update);
    return () => {
      mqLg.removeEventListener("change", update);
      mqSm.removeEventListener("change", update);
    };
  }, [base, sm, lg]);

  return columns;
}