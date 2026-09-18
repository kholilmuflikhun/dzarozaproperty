import type { Testimonial } from "./data";

export type TestimonialStats = {
  total: number;
  average: number;
  distribution: { star: number; count: number }[];
};

// Fungsi murni (tanpa fetch/side-effect) — aman dipakai baik di Server
// Component (mis. Hero, yang mengambil data lewat lib/testimonials.server)
// maupun Client Component (mis. TestimoniStats, yang datanya sudah ada di
// state hasil fetch /api/testimoni), karena tidak menyentuh googleapis
// ataupun kredensial sama sekali.
export function computeTestimonialStats(items: Testimonial[]): TestimonialStats {
  const total = items.length;
  const average = total ? items.reduce((sum, t) => sum + t.rating, 0) / total : 0;
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: items.filter((t) => t.rating === star).length,
  }));
  return { total, average, distribution };
}