# UX/UI Architect Reference

## 1. Purpose of this reference

This file exists to guide **world-class UX/UI decisions**, not visual decoration. The objective is to create **premium, high-trust, highly usable, polished experiences** that feel intentional at every level:

- **Page structure** — Layout and information architecture that support the user’s goal and reduce cognitive load.
- **Section composition** — Grouping, hierarchy, and rhythm so each area has a clear role and the page scans in a logical order.
- **Interaction design** — Affordances, feedback, and flows that increase confidence and reduce friction.
- **Component design** — Reusable, consistent, accessible components with complete state coverage.
- **Transitions** — Motion that improves continuity and clarity, not spectacle.
- **Motion** — Purposeful animation that reinforces hierarchy, feedback, and perceived responsiveness.
- **Responsiveness** — Desktop, tablet, and mobile behavior that preserves usability and priority.
- **Accessibility** — Semantic structure, keyboard and focus behavior, contrast, and inclusive interaction.
- **Perceived quality** — The cumulative effect of the above: an experience that feels crafted, trustworthy, and product-grade.

Use this reference as a **strategic and tactical playbook** when making interface and flow decisions. Every recommendation should translate into concrete implementation choices, not vague “best practices.”

---

## 2. Quality bar

Define the bar in strong, operational terms:

- **World-class** — The experience stands up to comparison with the best products in the same category (SaaS, onboarding, dashboards, etc.). Hierarchy is obvious, next steps are clear, and the user rarely wonders “what do I do now?”
- **Premium** — Visual and interaction quality signal care and competence. Typography, spacing, and component treatment feel intentional. Nothing looks like a default theme or placeholder.
- **Refined** — No unnecessary elements. Every pixel and state earns its place. Restraint is visible.
- **Polished** — All states (default, hover, focus, loading, empty, error, success) feel designed. Transitions are smooth and purposeful. No rough edges.
- **Product-grade** — Implementation is maintainable, performant, and accessible. This is shippable product UI, not a concept or mockup.
- **High-trust** — The user feels the product is reliable, clear, and in control. Errors are handled well, progress is visible, and the system does not surprise the user in negative ways.

**Principles that define this bar:**

- **Clarity before ornament** — If something is pretty but unclear, fix clarity first. Decoration never replaces structure.
- **Elegance with usability** — Aesthetic quality and task completion go together. Neither is optional.
- **Premium without noise** — Rich hierarchy and refinement, not visual clutter. Restraint is part of premium.
- **Dense when useful, breathable when needed** — Information density follows context. Dashboards can be dense; landing hero areas can breathe. Avoid uniform “airy” or “dense” everywhere.
- **Motion with purpose** — Every animation should improve understanding, continuity, or feedback. No motion for decoration only.
- **Friction reduction over visual gimmicks** — Removing a step or clarifying a label often beats adding another visual effect.
- **Every state should feel designed** — Default, hover, focus, active, disabled, loading, empty, error, success, skeleton. If it can happen, it should look and behave intentionally.
- **Every interaction should increase confidence** — Clicks, submits, and navigations should have clear feedback and predictable outcomes.

---

## 3. Inspiration sources

Use these as **taste calibration sources**, not blueprints to copy. The goal is to internalize what “excellent” looks and feels like, then apply that standard to your product’s context, constraints, and design system.

### Award-winning websites (e.g. Awwwards)

- **Use for:** Editorial layouts, bold typography, scroll and reveal behavior, narrative flow, and ambitious visual language.
- **Extract:** Hierarchy, pacing, use of space, and how motion supports narrative.
- **Do not copy blindly:** Many award sites prioritize impact over day-to-day usability and accessibility. Translate the *level of craft* into product-appropriate patterns (e.g. clear CTAs, scannable content, accessible contrast).
- **Translate to product:** Borrow confidence in typography and spacing; avoid one-off art-direction that you cannot maintain across the product.

### Curated galleries (e.g. Godly, Land-book, Lapa Ninja)

- **Use for:** Landing pages, feature sections, pricing blocks, testimonials, and conversion-oriented layouts.
- **Extract:** Section composition, CTA placement, trust elements, and how density and whitespace are balanced.
- **Do not copy blindly:** Many examples are marketing one-offs with custom assets. Your product has recurring patterns and a design system.
- **Translate to product:** Reuse the *structure* (e.g. hero → problem → solution → social proof → CTA) and the *quality of hierarchy*, not the exact visuals.

### High-end SaaS and product interfaces

- **Use for:** Dashboards, sidebars, data tables, filters, settings, and in-app flows.
- **Extract:** Information density, navigation patterns, empty and loading states, and how complex UIs stay scannable.
- **Do not copy blindly:** Every product has different scope. Avoid importing complexity you don’t need.
- **Translate to product:** Adopt patterns that fit your stack (e.g. command palette, sidebar behavior) and make them consistent with your system.

### Component and UI libraries (official examples)

- **Use for:** Form behavior, modal/drawer patterns, tabs, toasts, and accessibility patterns.
- **Extract:** State coverage, focus management, keyboard behavior, and API design for composability.
- **Do not copy blindly:** Default styling is a starting point. Elevate with your typography, spacing, and motion to match your quality bar.
- **Translate to product:** Use primitives and patterns from these libraries; style and motion should feel like your product, not the default theme.

### Motion and interaction showcases

- **Use for:** Micro-interactions, page transitions, loading and skeleton behavior, and gesture feedback.
- **Extract:** Timing, easing, and how motion clarifies state changes and hierarchy.
- **Do not copy blindly:** Marketing and portfolio motion is often heavier than product UI should be. Product motion should be subtle and fast.
- **Translate to product:** Shorter durations (200–400 ms), subtle eases, and motion that reinforces feedback and continuity rather than impressing.

---

## 4. Product archetypes to study

Study these categories to build a mental model of what excellence looks like in each. For each, focus on *what makes it work*, *what good hierarchy looks like*, *common mistakes*, and *patterns worth adapting*.

### Premium SaaS dashboards

- **What makes it excellent:** Clear primary metric or action; secondary information grouped logically; navigation that scales; data density without clutter; consistent card/table patterns.
- **Good hierarchy:** One primary focus per view; clear visual weight for primary vs secondary actions; consistent spacing and alignment.
- **Common mistakes:** Too many equal-weight cards; weak primary CTA; inconsistent filters and tables; no empty/loading states.
- **Patterns worth adapting:** Command palette, collapsible sidebar, metric cards with clear labels, data tables with sort/filter and loading skeletons.

### Onboarding and activation flows

- **What makes it excellent:** One clear step at a time; progress visible; low cognitive load; easy to skip or defer when appropriate; clear value at each step.
- **Good hierarchy:** Single primary action per screen; progress indicator; minimal distraction.
- **Common mistakes:** Too many steps; unclear progress; no way to save and continue; walls of text; weak CTAs.
- **Patterns worth adapting:** Step indicator, single-column focused layout, optional vs required clearly marked, success state before moving on.

### Productivity tools

- **What makes it excellent:** Keyboard-first where it helps; fast feedback; minimal modal interruption; lists and views that scale.
- **Good hierarchy:** Primary content dominates; tools and filters secondary but discoverable.
- **Common mistakes:** Too many modals; slow transitions; weak keyboard support; cluttered toolbars.
- **Patterns worth adapting:** Inline editing, quick add, keyboard shortcuts, dense but readable lists.

### Education platforms

- **What makes it excellent:** Clear learning path; progress and completion visible; content hierarchy (sections, lessons); minimal distraction during learning.
- **Good hierarchy:** Course/section/lesson clear; “next” and “back” obvious; progress and time expectations clear.
- **Common mistakes:** Unclear sequence; no progress; overwhelming content blocks; weak mobile experience.
- **Patterns worth adapting:** Progress bars, collapsible curriculum, clear “Resume” and “Next lesson,” completion states.

### Commerce and conversion-driven pages

- **What makes it excellent:** Clear value proposition; obvious primary CTA; trust signals; reduced friction at checkout; clear product hierarchy.
- **Good hierarchy:** Hero with one main message and one main CTA; benefits and proof; then secondary actions.
- **Common mistakes:** Multiple competing CTAs; weak trust; long forms without progress; unclear pricing.
- **Patterns worth adapting:** Sticky CTA where appropriate, trust badges, simplified checkout steps, clear pricing comparison.

### Editorial or content-heavy experiences

- **What makes it excellent:** Readable typography; clear article structure; related content and navigation that don’t overwhelm.
- **Good hierarchy:** Title and meta; body; supporting elements (toc, related) clearly secondary.
- **Common mistakes:** Tiny type; no clear reading order; too many side elements; weak mobile reading experience.
- **Patterns worth adapting:** Constrained line length, clear heading levels, optional table of contents, minimal chrome.

### Enterprise interfaces (clarity and trust)

- **What makes it excellent:** Dense but organized; clear permissions and scope; audit and safety visible; consistent terminology.
- **Good hierarchy:** Role-appropriate actions; data and status clear; settings and admin discoverable but not dominant.
- **Common mistakes:** Cluttered; inconsistent terms; weak error and empty states; no clear “home” or scope.
- **Patterns worth adapting:** Breadcrumbs, clear sectioning, role-based navigation, robust table and filter patterns.

### High-end landing pages

- **What makes it excellent:** Strong first impression; one clear message per section; social proof and trust; single primary CTA path.
- **Good hierarchy:** Hero → problem/solution → proof → CTA; each section has one job.
- **Common mistakes:** Too much in the hero; weak contrast on CTAs; no clear next step; generic stock visuals.
- **Patterns worth adapting:** Section rhythm, CTA consistency, testimonial and logo placement, clear above-the-fold message.

### Design-forward portfolio experiences

- **Use for:** Taste and craft level; typography and motion confidence.
- **Translate to product:** Elevate your standard for polish; do not copy literal layout or motion that doesn’t serve your product’s usability.

### Mobile-first web interfaces

- **What makes it excellent:** Touch targets; thumb-friendly primary actions; reduced chrome; content-first; fast.
- **Good hierarchy:** One primary action per view; bottom or top primary CTAs; clear back/up.
- **Common mistakes:** Desktop layout shrunk; tiny tap targets; modals that don’t work on small screens.
- **Patterns worth adapting:** Bottom navigation, full-width CTAs, swipe where it adds value, responsive type and spacing.

---

## 5. Interface patterns worth mastering

For each pattern, aim for **excellence** (what good looks like), avoid **poor execution** (what bad looks like), and focus on the **UX principles** and **details** that separate average from elite.

### Navigation systems

- **Excellence:** Consistent placement; clear active state; scalable to many items; optional search or command palette; mobile collapse that doesn’t hide key actions.
- **Poor execution:** Inconsistent nav across app; no active state; too many top-level items; mobile as an afterthought.
- **Principles:** Discoverability, consistency, minimal cognitive load.
- **Elite details:** Keyboard support, focus management, clear hierarchy between primary and secondary nav.

### Sidebars

- **Excellence:** Collapsible when needed; clear grouping; icons + labels; active and hover states; responsive behavior (drawer on mobile).
- **Poor execution:** Always expanded with wasted space; no grouping; unclear active state; fixed width that breaks on small screens.
- **Principles:** Consistency, scannability, adaptability.
- **Elite details:** Animated collapse, persistent preference, overflow handling.

### Command palettes

- **Excellence:** Fast open (e.g. Cmd+K); search that matches actions and content; recent/frequent; keyboard-only use; clear categories.
- **Poor execution:** Slow; no search; no keyboard; obscure shortcut.
- **Principles:** Power-user efficiency, discoverability of actions.
- **Elite details:** Fuzzy search, section headers, optional icons, accessibility (focus trap, escape, announce).

### Dashboards

- **Excellence:** One primary metric or action; cards/tables consistent; filters and date range clear; empty and loading states; responsive grid.
- **Poor execution:** Everything same visual weight; no primary focus; no loading state; broken on mobile.
- **Principles:** Hierarchy, scannability, data density balanced with clarity.
- **Elite details:** Skeleton loaders, clear empty state with next action, export or drill-down where relevant.

### Data cards

- **Excellence:** Clear label and value; optional trend or comparison; consistent padding and alignment; optional action.
- **Poor execution:** Unclear what the number means; inconsistent styling; no loading state.
- **Principles:** One idea per card; consistency across dashboard.
- **Elite details:** Number formatting, optional sparkline or delta, hover/focus for secondary action.

### Filters

- **Excellence:** Visible active filters; clear apply/reset; URL or state that can be shared; accessible (keyboard, labels).
- **Poor execution:** Hidden in modal; no indication of active state; no clear “clear all.”
- **Principles:** Discoverability, reversibility, scannability of results.
- **Elite details:** Filter chips, count of results, loading state when applying.

### Tables

- **Excellence:** Sortable columns; clear headers; row states (hover, selected); loading skeleton; empty state; responsive (horizontal scroll or card stack on mobile).
- **Poor execution:** No sort; cramped; no loading; no empty state; unreadable on mobile.
- **Principles:** Scannability, performance (virtualization when needed), accessibility.
- **Elite details:** Sticky header, clear sort indicator, row actions on hover or menu, pagination or infinite scroll with care.

### Forms

- **Excellence:** Labels and hints clear; validation inline and at submit; required vs optional obvious; one column when possible; logical order and grouping.
- **Poor execution:** No labels; errors only on submit; unclear required; too many columns; no loading on submit.
- **Principles:** Reduce effort, reduce uncertainty, increase completion confidence.
- **Elite details:** Inline validation timing, clear error messages, disabled submit until valid or with loading state, optional progress for long forms.

### Multi-step flows

- **Excellence:** Progress visible; one step per screen (or clear sections); back/save and continue; summary before submit.
- **Poor execution:** No progress; too much per step; no way to go back; loss of data on refresh.
- **Principles:** Progress, control, recovery.
- **Elite details:** Step indicator, optional “Save and continue later,” validation per step, confirmation step.

### Onboarding

- **Excellence:** Short; clear value per step; skip or defer when appropriate; success state; link to help or docs.
- **Poor execution:** Long; no skip; no progress; generic copy.
- **Principles:** Time-to-value, optionality, clarity.
- **Elite details:** Progress, “Don’t show again,” tooltips or spotlights that don’t block, completion celebration.

### Pricing sections

- **Excellence:** Clear comparison; recommended plan obvious; feature list scannable; CTA per plan; FAQ or link to full comparison.
- **Poor execution:** Too many plans with no differentiation; weak CTA; unclear what’s included.
- **Principles:** Comparison clarity, trust, single primary CTA per plan.
- **Elite details:** Toggle annual/monthly, checkmarks for features, optional “Most popular” badge without overwhelming.

### Testimonials

- **Excellence:** Short; name, role, and optional photo; not generic; optional link to full story or review.
- **Poor execution:** Long blocks; no attribution; stock feel.
- **Principles:** Trust, brevity, authenticity.
- **Elite details:** Consistent card layout, optional logo, carousel only if needed with clear controls.

### Feature sections

- **Excellence:** One idea per section; clear headline and short supporting copy; visual (screenshot or diagram) supports the idea; consistent rhythm.
- **Poor execution:** Dense paragraphs; no visual hierarchy; all sections look the same.
- **Principles:** Scannability, one message per block.
- **Elite details:** Alternating layout optional, icon or image that reinforces message, CTA at end of section when relevant.

### Progress states

- **Excellence:** Visible progress (bar or steps); optional percentage or step count; clear what’s done and what’s next.
- **Poor execution:** No progress; or progress that doesn’t match actual state.
- **Principles:** Feedback, expectation setting.
- **Elite details:** Accessible label (e.g. “Step 2 of 4”), optional animation on step change.

### Empty states

- **Excellence:** Clear message; illustration or icon; single primary action to create or import; optional secondary help.
- **Poor execution:** Blank area; or only “No data” with no next step.
- **Principles:** Guidance, next step, tone.
- **Elite details:** Illustration that matches product tone, CTA that creates first item or opens help.

### Error states

- **Excellence:** Plain-language message; cause if helpful; single primary action (retry, go back, contact support); no blame.
- **Poor execution:** Technical message; no action; scary or blaming tone.
- **Principles:** Clarity, recovery, calm.
- **Elite details:** Inline vs full-page error, retry button, optional error code for support.

### Search experiences

- **Excellence:** Fast; results grouped (e.g. by type); recent or popular; keyboard navigation; clear empty and loading states.
- **Poor execution:** Slow; no feedback; no keyboard; no empty state.
- **Principles:** Speed, feedback, scannability.
- **Elite details:** Debounced input, highlight in results, focus trap in results list.

### Settings screens

- **Excellence:** Grouped sections; clear labels; destructive actions separated and confirmed; save feedback; optional breadcrumb.
- **Poor execution:** Flat list; unclear sections; destructive action mixed in; no save feedback.
- **Principles:** Grouping, safety, feedback.
- **Elite details:** Section headers, “Save” or auto-save with toast, confirm for destructive, optional “Reset to default.”

### Profile / account pages

- **Excellence:** Key info visible; edit in place or clear edit flow; avatar and identity clear; security and privacy discoverable.
- **Poor execution:** Cluttered; no clear edit path; no security entry point.
- **Principles:** Identity, control, trust.
- **Elite details:** Avatar upload with preview, clear sections (profile, security, notifications).

### Modals, drawers, popovers, dropdowns

- **Excellence:** Focus trap; escape to close; clear title or purpose; primary action obvious; accessible (focus, aria).
- **Poor execution:** No focus trap; no escape; unclear purpose; multiple competing actions.
- **Principles:** Interruption only when needed; clear exit; accessibility.
- **Elite details:** Focus return on close, scroll lock, optional animation that doesn’t block interaction.

### Tabs and segmented controls

- **Excellence:** Clear selected state; keyboard (arrows); content changes without full reload; accessible role and labels.
- **Poor execution:** Unclear selected; no keyboard; full reload on change.
- **Principles:** Clear active state, keyboard support, performance.
- **Elite details:** Optional URL sync, optional lazy load of panel content.

### Carousels and horizontal content rails

- **Excellence:** Clear navigation (arrows, dots, or scroll); optional keyboard; no auto-play or user-controlled; loading and empty handled.
- **Poor execution:** Auto-play with no pause; no keyboard; no indication of more content; broken on mobile.
- **Principles:** Control, discoverability, accessibility.
- **Elite details:** Optional snap points, visible “more” indicator, reduced motion preference respected.

### Dense information layouts

- **Excellence:** Clear grouping; consistent alignment; hierarchy via weight and spacing; optional zebra or hover for rows.
- **Poor execution:** No grouping; inconsistent alignment; everything same weight.
- **Principles:** Scannability, hierarchy, consistency.
- **Elite details:** Sticky headers, clear column alignment, optional truncation with tooltip or expand.

### Premium mobile layouts

- **Excellence:** Touch targets ≥44px; primary action thumb-reachable; bottom or top nav; content-first; fast.
- **Poor execution:** Small taps; primary action in middle; desktop layout scaled down.
- **Principles:** Touch, reachability, performance.
- **Elite details:** Bottom sheet for secondary actions, swipe gestures where they add value, responsive type scale.

---

## 6. Motion and interaction philosophy

Motion should **improve** continuity, clarity, hierarchy, perceived responsiveness, delight, and confidence. It should never be the main point.

**How motion helps:**

- **Continuity** — Elements that move or appear in place feel connected (e.g. list reorder, expand/collapse).
- **Clarity** — Direction and duration reinforce what changed (e.g. slide for “new panel,” fade for “same context”).
- **Hierarchy** — Stagger or order of reveal can reinforce importance (e.g. hero first, then supporting content).
- **Perceived responsiveness** — Immediate feedback (e.g. button press, loading skeleton) makes the product feel faster.
- **Delight** — Subtle, purposeful motion (e.g. success check, gentle hover) adds polish without distraction.
- **Confidence** — Clear feedback on action (e.g. submit → loading → success) reduces uncertainty.

**Types of motion:**

- **Premium motion** — Short (200–400 ms), subtle easing, supports state change or hierarchy. User may not “notice” it but the experience feels better.
- **Distracting motion** — Too long, too bouncy, or decorative. Draws attention away from the task.
- **Cinematic motion** — Fine for marketing or narrative; usually too heavy for in-app product UI.
- **Product motion** — Fast, purposeful, consistent with the rest of the product. Default choice for UI.
- **Transition polish** — Small refinements (e.g. crossfade, slight slide) that make navigation feel connected.
- **Gimmicky animation** — Animation for its own sake; avoid.

**Rules by context:**

- **Hover:** Quick (100–200 ms), subtle (e.g. slight lift, border or background change). Affordance, not spectacle.
- **Pressed:** Immediate feedback (scale or opacity). Confirms click.
- **Focus:** Visible focus ring; optional subtle glow or outline. Never remove focus indication.
- **Reveal:** Short stagger (50–100 ms between items) if used; keep total duration under ~400 ms.
- **Page transitions:** Short (200–300 ms); prefer fade or short slide. Don’t block interaction.
- **Loading:** Skeleton or spinner; avoid long indeterminate waits without progress when possible.
- **Skeletons:** Match content shape; subtle pulse or shimmer; replace with content when ready.
- **Scroll-based motion:** Use sparingly; prefer subtle (e.g. parallax, fade-in). Respect prefers-reduced-motion.
- **Stagger:** Small delays between list or card items; total under ~400 ms so the page doesn’t feel slow.
- **Layout transitions:** When layout changes (add/remove/move), short transition (200–300 ms) to avoid jumpiness.
- **Gesture responsiveness:** Touch feedback immediate (e.g. list item press state); swipe or pull to refresh with clear completion.

**Red flags:** Motion that lasts >500 ms for small UI changes; motion that cannot be disabled or reduced for accessibility; motion that repeats indefinitely without user control; motion that obscures content or blocks interaction.

---

## 7. Recommended libraries and when to use them

Use libraries to get **quality and consistency** faster; then align them with your design system and quality bar.

### Design system and components

**shadcn/ui**

- **Best for:** Accessible, customizable React components built on Radix; you own the code (copy into repo).
- **When to use:** App UI (dashboards, tools, internal products); when you want full control over styling and behavior.
- **When not to use:** When you need a drop-in theme with zero customization, or when you’re not using React.
- **Quality it unlocks:** Accessibility (Radix), consistent API, Tailwind-based styling that you can refine.
- **Avoid:** Using every component as-is without aligning to your spacing, type, and motion; stacking too many primitives without a clear pattern.

**Radix Primitives**

- **Best for:** Unstyled, accessible behavior (focus, keyboard, aria). Compose your own UI on top.
- **When to use:** When you need maximum control and already have a design system; when building a design system.
- **When not to use:** When you want styled components out of the box; when you need something very simple and don’t need full accessibility primitives.
- **Quality it unlocks:** Robust focus management, modals/dropdowns/tabs that behave correctly, screen-reader support.
- **Avoid:** Building one-off compositions that don’t become reusable patterns; ignoring the styling layer (you must add it).

**React Aria / React Aria Components**

- **Best for:** Accessibility and behavior for complex components (tables, date pickers, etc.); Adobe’s design system approach.
- **When to use:** When you need strong a11y and are okay with their mental model and styling approach.
- **When not to use:** When you’re already deep on Radix/shadcn and don’t need a second primitive layer.
- **Quality it unlocks:** Keyboard, focus, and screen-reader behavior for complex widgets.
- **Avoid:** Mixing with Radix in the same component tree without a clear boundary; ignoring styling and theming.

### Motion and animation

**Motion (Framer Motion)**

- **Best for:** Declarative React animation; layout animations; gesture-based interactions; page transitions.
- **When to use:** React apps where you want consistent, declarative motion without writing raw CSS/GSAP.
- **When not to use:** When bundle size is critical and you only need simple CSS transitions; when you’re not in React.
- **Quality it unlocks:** Layout animation, stagger, gesture (drag, tap), AnimatePresence for exit.
- **Avoid:** Over-animating (long durations, too many animated props); using it for every small hover (CSS is enough for simple cases).

**GSAP**

- **Best for:** Timeline-based, precise control; complex sequences; scroll-driven animation; non-React or mixed stacks.
- **When to use:** Marketing pages, landing pages, or any place where you need scroll-linked or sequence-based animation.
- **When not to use:** Simple UI state transitions (CSS or Motion is simpler); when you don’t need timeline control.
- **Quality it unlocks:** ScrollTrigger, timelines, precise easing; industry standard for “premium” marketing motion.
- **Avoid:** Using GSAP for every small UI transition; ignoring reduced-motion preferences.

### Scroll and feel

**Lenis**

- **Best for:** Smooth scrolling (momentum, easing) on marketing or editorial pages.
- **When to use:** When scroll feel is part of the experience (landing, storytelling). Use sparingly.
- **When not to use:** In dense app UI (dashboards, tools) where native scroll is expected; when accessibility or performance is a concern.
- **Quality it unlocks:** Premium scroll feel; can integrate with scroll-based animation.
- **Avoid:** Enabling everywhere; using when you don’t have a clear reason (adds weight and can conflict with native behavior).

### Carousels and content rails

**Embla Carousel**

- **Best for:** Touch-friendly carousels and horizontal rails; minimal API; accessible.
- **When to use:** When you need a carousel or horizontal scroll with dots/arrows and optional snap.
- **When not to use:** When a simple horizontal scroll (CSS overflow) is enough; when you need heavy customization that conflicts with Embla’s model.
- **Quality it unlocks:** Consistent behavior across devices; optional plugins (autoplay, etc.); small footprint.
- **Avoid:** Auto-play without user control; carousels that hide content from keyboard or screen readers.

### Icons

**Lucide**

- **Best for:** Consistent, clean icon set; tree-shakeable; React/SVG.
- **When to use:** Default choice for product UI when you need a single, consistent set.
- **When not to use:** When you need a very specific style (illustration, brand icons) that Lucide doesn’t cover.
- **Quality it unlocks:** Consistency, size/stroke control, accessibility (use with aria-label or sr-only text when icon-only).
- **Avoid:** Mixing many icon libraries; using icons without semantic or visible labels when they’re the only content.

---

## 8. Library selection framework

Choose stack by **context**: app vs marketing, interactivity level, accessibility and scale needs, and motion needs.

- **App interface with premium usability (dashboard, tool, SaaS)**  
  Prefer: **shadcn/ui** (or Radix) + **Motion** for layout and micro-interactions + **Lucide**.  
  Focus: Accessibility, consistency, state coverage, maintainability. Avoid heavy scroll libraries and decorative motion.

- **Highly interactive marketing site**  
  Prefer: **React** (or your framework) + **GSAP** (scroll, sequences) + **Lenis** only if scroll feel is a stated goal + **Motion** for UI-level transitions.  
  Focus: Impact and narrative; keep core interactions (CTAs, forms) accessible and fast.

- **Dashboard that needs accessibility and scalability**  
  Prefer: **Radix** or **shadcn/ui** + **Motion** only where it improves feedback (e.g. toasts, modals) + **Lucide**.  
  Avoid: Lenis, heavy GSAP, decorative animation. Prefer CSS for simple hovers and transitions.

- **Onboarding flow with polished transitions**  
  Prefer: **shadcn/ui** (or Radix) + **Motion** (AnimatePresence, layout, stagger for steps).  
  Focus: Step clarity, progress, one primary action per step; motion that reinforces progress, not spectacle.

- **Content-heavy page with subtle motion**  
  Prefer: **Motion** for scroll-triggered fade/slide if needed; otherwise **CSS**. Optional **Lenis** only if scroll feel is part of the brief.  
  Focus: Readability, hierarchy, optional “reveal” motion that respects reduced-motion.

- **Enterprise UX with strict clarity needs**  
  Prefer: **Radix** or **React Aria** for robust a11y + your design system + **Lucide**.  
  Minimize motion; prefer CSS transitions. Focus: Consistency, keyboard, screen readers, and clarity over “wow.”

---

## 9. Premium UI heuristics

Use this as a **checklist** to judge whether a UI meets a high bar. If most are true, the experience is likely premium; if many fail, prioritize fixes.

- **Clear hierarchy in under 3 seconds** — User can tell what’s primary and what’s secondary without reading everything.
- **Obvious primary action** — One main CTA or next step per view (or per section where appropriate).
- **Smooth scannability** — Headings, labels, and grouping make it easy to scan and jump.
- **Consistent spacing rhythm** — Spacing uses a scale (e.g. 4/8/16/24/32); no arbitrary one-off values.
- **Precise grouping** — Related items are visually grouped; unrelated items are separated.
- **No visual dead zones** — No large areas that look unfinished or meaningless.
- **No accidental clutter** — Nothing competes for attention without a reason.
- **Confidence in form completion** — Labels, validation, and submit feedback reduce uncertainty.
- **Designed empty/loading/error states** — Every state has a clear message and, where relevant, a next action.
- **Responsive comfort on mobile** — Layout, tap targets, and content order work on small screens.
- **Touch target quality** — Interactive elements are at least ~44px and have adequate spacing.
- **Clean icon usage** — Icons are consistent in style and size; icon-only elements have accessible labels where needed.
- **State completeness** — Default, hover, focus, active, disabled, loading, empty, error, success are all considered and designed.
- **Premium but restrained visual language** — Typography, color, and effects feel intentional; nothing looks like a default theme or random decoration.

---

## 10. Anti-patterns to avoid

These **hurt** perceived quality and usability. Avoid them and fix them when present.

- **Huge cards without purpose** — Oversized cards waste space and weaken hierarchy. Use size to signal importance; keep cards proportional to content.
- **Excessive vertical whitespace** — Too much empty space between sections makes the page feel empty and pushes content below the fold. Use a consistent rhythm; breathe where it helps focus.
- **Weak CTA emphasis** — Primary action should stand out (color, weight, placement). If it looks like a secondary button, conversion and clarity suffer.
- **Generic gradients everywhere** — Gradients as filler look cheap. Use color with purpose (e.g. subtle background, brand accent).
- **Meaningless glassmorphism** — Frosted glass only helps when it solves a real problem (e.g. overlay context). Using it everywhere adds noise and can hurt contrast.
- **Overuse of shadows** — Heavy or inconsistent shadows feel noisy. Use elevation sparingly and consistently.
- **Animation for decoration only** — Motion that doesn’t improve feedback, continuity, or hierarchy distracts and can hurt performance and accessibility.
- **Inaccessible motion** — Auto-playing, long, or unavoidable motion can harm users. Respect `prefers-reduced-motion` and provide pause/disable.
- **Inconsistent radii and spacing** — Random border-radius or spacing values make the product feel unpolished. Use a token system.
- **Over-designed dashboards** — Too many charts, widgets, or options with equal weight. Establish a clear primary focus and simplify.
- **Too many competing highlights** — If everything is bold, colored, or animated, nothing stands out. Reserve emphasis for what matters.
- **Landing pages with no hierarchy** — Hero, problem, solution, proof, and CTA should be visually distinct and in a logical order.
- **Modals with weak focus management** — Modal must trap focus, have a clear title, and close on Escape; focus should return on close. Without this, keyboard and screen-reader users suffer.
- **Form flows that create uncertainty** — Unclear required fields, errors only on submit, or no progress in long forms increase abandonment. Reduce uncertainty and show progress.
- **Inconsistent mobile behavior** — Navigation, CTAs, or key actions that work on desktop but are missing or broken on mobile. Treat mobile as a first-class context.

---

## 11. Screen-by-screen evaluation framework

Use this when **evaluating a single screen**. Go through each dimension and note passes and failures.

- **First impression** — Does the screen look intentional and trustworthy within the first few seconds?
- **Hierarchy** — Is there a clear primary and secondary? Is visual weight aligned with importance?
- **Scannability** — Can the user find key information without reading everything? Are headings and groups clear?
- **CTA quality** — Is the primary action obvious? Is it placed and styled so it’s hard to miss?
- **Interaction feedback** — Do hover, focus, and pressed states work? Is there clear feedback on click or submit?
- **Density** — Is information density appropriate (not cramped, not wasteful)?
- **Visual rhythm** — Does spacing follow a consistent scale? Do sections feel balanced?
- **Trust** — Are trust signals (testimonials, logos, security, clarity) present where they matter?
- **State completeness** — Are loading, empty, error, and success states designed and implemented?
- **Responsiveness** — Does the layout and interaction work on target breakpoints? Are touch targets adequate?
- **Accessibility** — Is structure semantic? Is focus visible? Are labels and errors announced? Is contrast sufficient?
- **Emotional tone** — Does the tone (copy and visual) match the product and the moment (e.g. onboarding vs error)?
- **Consistency with the system** — Does the screen use shared components, tokens, and patterns, or does it introduce one-offs?

---

## 12. Flow-level evaluation framework

Use this when **evaluating a full journey** (onboarding, checkout, multi-step form, etc.), not just one screen.

- **Entry point quality** — Is it clear where to start and what the user will get?
- **Clarity of next step** — At each step, is it obvious what to do next?
- **Reduction of friction** — Are steps and fields minimized? Is there unnecessary back-and-forth?
- **Error recovery** — When something fails, is the message clear and is there a path to fix or retry?
- **Confidence at each step** — Does the user feel in control and informed (e.g. progress, expectations)?
- **Progress visibility** — Is it clear how far along the user is and what’s left?
- **Time-to-value** — How quickly does the user reach the first “win” or completion? Can it be shortened?
- **Dead ends** — Are there paths that lead nowhere or leave the user stuck?
- **Retention friction** — After completion, is it clear what to do next (e.g. “Go to dashboard”)?
- **Conversion friction** — For signup or purchase flows, where might users drop off? Are CTAs and trust in place?
- **Emotional continuity** — Does the tone and visual language stay consistent across the flow, and does the end feel like a clear success?

---

## 13. Implementation mindset

Translate **design excellence** into **frontend implementation** with these principles.

- **Reuse before inventing** — Use existing components and patterns. Only add new ones when the system doesn’t support the need.
- **Extend the design system when needed** — When you add something new, make it reusable and consistent (tokens, variants) so it becomes part of the system.
- **Preserve maintainability** — Clear structure, naming, and composition. Avoid one-off inline styles or markup that can’t be updated safely.
- **Preserve performance** — Lazy-load when appropriate; keep animations cheap; avoid layout thrash and unnecessary re-renders.
- **Preserve semantics** — Use the right elements (headings, buttons, links, landmarks) and ARIA where needed so the UI is understandable by assistive tech.
- **Improve states, not just static screens** — Implement hover, focus, disabled, loading, empty, error, success (and skeleton where relevant). Static mockups are not enough.
- **Build production-grade UI, not mockup-grade UI** — Code should be shippable: accessible, responsive, performant, and maintainable.
- **Always do a polish pass after implementation** — After the first pass, review spacing, hierarchy, states, and motion; refine until it meets the quality bar.

---

## 14. Default operating rules for the ux-ui-architect

Whenever the subagent works, it should follow this **operational sequence**:

1. **Audit first** — Inspect the current screen, component set, or flow (layout, structure, code, related routes). Do not jump to solutions.
2. **Identify friction and weak hierarchy** — Name specific problems: where the user might hesitate, where hierarchy is unclear, where states are missing or poor.
3. **Propose the highest-impact improvements** — Prioritize changes that improve journey clarity, scannability, and interaction quality over cosmetic tweaks.
4. **Implement directly** — Make changes in code. Reuse and extend the design system; preserve accessibility and performance.
5. **Review states and responsiveness** — Ensure default, hover, focus, loading, empty, error, and success are covered; check breakpoints and touch targets.
6. **Do a final polish pass** — Refine spacing, alignment, motion, and microcopy so the result feels intentional.
7. **Check if the result actually feels premium and world-class** — Use the Screen-by-screen and Flow-level frameworks. If it still feels generic or underdesigned, refine further before stopping.

**Tone:** Be decisive, demanding, and practical. Explain briefly what’s wrong and what was improved; then implement; then summarize. Aim for an exceptional product experience, not just a nicer screen.
