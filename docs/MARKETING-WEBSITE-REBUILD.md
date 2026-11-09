# Marketing Website Rebuild — Property-first UX

Date: 2026-11-09

## Objective

Rebuild the public Dzaroza Property experience inside the existing `apps/marketing` workspace. This is a presentation-layer improvement, not a second marketing application and not a replacement of the platform architecture.

## Preserve

- Existing navbar destinations and section IDs: Produk Digital, Layanan, Portofolio, Testimoni, Company Profile, FAQ.
- Existing page sequence and functional components: product catalog/detail, Midtrans checkout, service consultation/order form, portfolio filters/lightbox, testimonials, company profile, map, team, FAQ, privacy page, SEO metadata, sitemap, robots, structured data, WhatsApp contact and analytics.
- Existing copywriting and business positioning: managerial property, build/renovation, titip-jual, cost and fee 10%, akad jelas, amanah, transparan, and bebas gharar.
- Existing logo, before/after comparison photos, portfolio photography, product covers, team assets, and all public media paths.
- Existing white / charcoal-black / orange visual identity and blueprint motif.

## UX improvements

- Make the hero communicate property management and built-environment work immediately, with a stronger hierarchy and a prominent property consultation action.
- Keep the before/after property showcase interactive and responsive on mobile, tablet and desktop.
- Improve navigation contrast, touch target sizing, keyboard focus, mobile menu semantics and reduced-motion behavior.
- Use clearer content widths, spacing, card hierarchy, responsive typography and section rhythm without changing the information architecture.
- Do not fabricate performance metrics or testimonials. An empty testimonial dataset must not display a fabricated 5.0 rating.

## Monorepo boundary

The monorepo baseline is retained:

- `apps/marketing`: public website and public-facing integrations.
- `apps/ops`: authenticated multi-tenant managerial-property application.
- `apps/worker`: background processing foundation.
- `packages/database`: Prisma/PostgreSQL models and migrations.
- `packages/shared`: shared domain contracts.

This website phase must not alter Ops authorization, tenant isolation, database schema/migrations, payment entitlements, document security, production secrets, DNS, or deployment targets.

## Validation gates

1. Frozen pnpm workspace install.
2. Marketing and Ops TypeScript checks.
3. Unit tests and Prisma schema/migration/tenant integrity checks.
4. Production build for all workspace apps.
5. Marketing smoke tests for `/`, `/privasi`, `/robots.txt`, and `/sitemap.xml`.
6. Responsive review at 360px, 768px, 1024px and desktop widths.
7. Keyboard/focus, reduced motion, image loading, horizontal overflow and mobile navigation checks.
8. Preview deployment and browser UAT before any production release.

No Production deployment, DNS change, migration, or merge to `main` is authorized by this phase.
