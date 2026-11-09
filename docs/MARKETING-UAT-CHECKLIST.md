# Dzaroza Property Marketing — UAT & Release Gate

Status: **NOT STARTED — awaiting visual QA and preview access**  
Branch: `feat/marketing-property-website-rebuild-v3`  
PR: #25  
Production release: **LOCKED — explicit owner approval required**

## 1. Entry criteria

- [ ] Latest feature-branch GitHub Actions run is green.
- [ ] Latest Vercel staging deployment is READY and points to the tested commit.
- [ ] Preview can be opened by the tester (Vercel team authentication completed).
- [ ] No unresolved critical/high accessibility, functional, or security findings.
- [ ] No Production DNS, secrets, database, or deployment settings were changed by this test.

## 2. Visual QA matrix

Test each viewport: 360px mobile, 390px mobile, 768px tablet, 1024px tablet/small desktop, 1440px desktop.

| Area | Checks | Expected result |
|---|---|---|
| Navbar | desktop links, mobile menu, close behavior, focus, section anchors | no clipped links; menu usable by touch and keyboard; correct destinations |
| Hero | headline, CTA, before/after slider, imagery | readable hierarchy; CTA works; slider responds to pointer/touch/keyboard |
| Products | cards, pagination, swipe, checkout CTA | cards fit viewport; pagination state correct; no accidental swipe when tapping controls |
| Services | service cards and consultation actions | all actions lead to the intended section/form/contact |
| Portfolio | category filters, cards, lightbox | filters update correctly; lightbox opens/closes; no horizontal overflow |
| Lightbox | arrows, Escape, Tab/Shift+Tab, focus restore, swipe | one step per key press; focus stays in dialog and returns on close; page scroll locked while open |
| Team | member cards, pagination, lightbox | tap opens correct profile image; swipe does not trigger accidental click |
| Testimonials | API empty/loading state, auto-slide, pause, controls | no fabricated ratings; controls work; auto-slide pauses on interaction and respects reduced motion |
| Company profile | copy, map/location links, values | content readable; links work; no clipped map or text |
| FAQ | accordion, keyboard, WhatsApp CTA | expanded state announced; controls keyboard accessible; CTA correct |
| Footer | navigation, social/contact links | all destinations valid and usable |

## 3. Accessibility checks

- [ ] Complete primary journey using keyboard only.
- [ ] Visible focus indicator on interactive elements.
- [ ] Heading hierarchy and landmark structure are coherent.
- [ ] Images have useful alternative text; decorative images are hidden from assistive technology.
- [ ] Lightbox exposes dialog semantics, traps focus, closes with Escape, and restores focus.
- [ ] Carousel labels and slide position are understandable to screen readers.
- [ ] Reduced-motion preference suppresses nonessential animation/autoplay.
- [ ] Text and controls meet WCAG 2.2 AA contrast and target-size expectations.

## 4. Performance checks

Capture a fresh Lighthouse report for mobile and desktop on the exact Preview commit. Record raw report URLs or artifacts; do not infer metrics from build success.

Recommended release targets:
- [ ] Lighthouse Performance: >= 90 (mobile and desktop; investigate any environment-related variance).
- [ ] Core Web Vitals targets: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1.
- [ ] No unexpected layout shift from images, fonts, carousels, or late content.
- [ ] Hero/LCP image is prioritized; below-the-fold imagery is lazy-loaded where appropriate.
- [ ] Responsive image sizes avoid unnecessarily downloading desktop-sized assets on mobile.
- [ ] No avoidable client-side JavaScript or console errors on the public landing page.
- [ ] Verify font loading, third-party scripts, analytics and payment script behavior with Preview-only configuration.

## 5. Functional UAT journeys

- [ ] Visitor navigates from Hero CTA to service consultation and can submit a valid test enquiry.
- [ ] Visitor can browse portfolio, filter projects, open an image, navigate images, and close the lightbox.
- [ ] Visitor can browse products and reach the intended purchase flow. Use sandbox only; no real payment.
- [ ] Visitor can submit testimonial form using test data if Preview integration is configured; verify moderation/empty state otherwise.
- [ ] Visitor can use FAQ, company profile, WhatsApp and footer links.
- [ ] Direct routes `/`, `/privasi`, `/robots.txt`, and `/sitemap.xml` respond as expected.
- [ ] Verify mobile navigation and all key journeys at 360px and 390px.
- [ ] Confirm no cross-tenant/Ops behavior is altered by this marketing-only change.

## 6. Defect severity

- **Blocker:** data/security issue, payment against live credentials, broken primary CTA, page unavailable.
- **High:** major layout break, inaccessible primary journey, incorrect business/akad information, critical navigation failure.
- **Medium:** isolated interaction or responsive defect with a workaround.
- **Low:** cosmetic inconsistency without user journey impact.

Blocker and High defects must be fixed and retested before UAT approval.

## 7. UAT sign-off

Tester:  
Test date:  
Preview URL and deployment commit:  
Device/browser matrix:  
Open defects (ID, severity, evidence):  
UAT result: **PENDING / PASS / FAIL**  
Owner approval for Production release: **NOT GRANTED**

Passing CI or UAT does not itself authorize Production. Production release requires a separate, explicit approval from the owner after reviewing the evidence.
