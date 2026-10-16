# RIVER signal studio

The interface is a precise, quiet frame for learning signals. Existing explanations,
learning boundaries, personal progress and numerical experiments are the source of truth.

## References and interpretation

The surface hierarchy in [Linear's design analysis](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md)
and the measured typography and spacing in [IBM's design analysis](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/ibm/DESIGN.md)
informed this refinement. These are principles, not copies of those brands. RIVER retains
its dark instrument palette, Chinese reading experience and existing data-series colors.

## Visual system

- Ground: `#0a1119`; reading surface: `#111e2b`; instrument well: `#080f17`.
- Primary text: `#e6f0f5`; secondary text: `#a9bac9`; rules: `#2b4052`.
- Signal/action: `#7ddbd1`; secondary trace: `#8fbfff`; caution/secondary component: `#e5c080`.
- A native sans-serif stack with CJK fallbacks; monospace only for symbols and code.
- A 4px spacing rhythm, 1280px learning-map container, 8–12px panel radii.
- The overview owns the expressive signal composition. Reading pages remain quiet.
- Two-column subject index on desktop, single-column compact cards on phones.
- Preserve the four primary destinations and all status labels. A visible page is not evidence of mastery.

## Motion contract

`signal-motion.js` adds illustrative packets to curated signal-flow paths. It never
changes experiment traces or storage. Probability densities and response plots stay
static. The overview's two frequency components are a schematic, not measured data.

One shared, capped 30 fps scheduler updates pre-created SVG circles using cached geometry.
Offscreen figures, hidden topic panels and background documents do not animate. Reduced
motion, print and the visible pause control are respected. No random clouds, blur filters,
3D tilt, pointer chasing, layout animation, dependencies or network requests.

## Maintenance

Load `signal-design.css` last, after page-specific CSS, and `signal-motion.js` with `defer`.
`build-exploration.py` retains these includes. Keep `index.html` and `knowledge.html`
identical. Never place presentation code in learning-progress or simulation engines.

Before a release, compare lesson text, links, IDs, data attributes and all unchanged
engine assets against the base commit. Check mobile overflow, keyboard navigation,
Back/Forward, hidden topic views, pause/reduced motion, and simulator iframe switching.
