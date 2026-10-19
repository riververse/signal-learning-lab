# RIVER mathematical studio

The interface is a clean coordinate space for learning signals. Lesson content,
learning evidence, local self-reported progress and numerical experiments remain
the source of truth. The approved visual direction is cool, geometric and typographic.

## Visual system

- Ground: `#f2f5fa`; plot/reading surfaces: `#ffffff`; graphite text: `#202734`.
- Secondary text: `#536176`; quiet rules: `#bdc8d8`; primary action: `#4b43e8`.
- Data series: graphite truth/reference, teal `#087d70`, blue `#1d64b3`,
  ochre `#9a5800`, violet `#8748a7`, rose `#b74167`. Keep labels, legends,
  dash patterns and point shapes: color alone must not carry meaning.
- Native sans-serif with CJK fallbacks; monospace for coordinates, symbols and code.
- Generous whitespace, strong type hierarchy, thin rules, restrained radii.
- Reading boundaries follow meaning: one continuous white notebook sheet with chapter
  rules, distinct project/recommendation surfaces, and cool `#e9edf6` inset controls.
  Long supporting prose uses `#344155`; reserve quieter text for metadata. Keep plot
  areas white and separate controls/captions with spacing and fine rules, not heavy frames.
- The overview owns the expressive waveform composition. Its full-width topic
  directory is a reading index, not a wall of identical cards.
- Reading pages and instruments use the same cool surfaces and typographic system.
  No paper texture, warm editorial palette, glow field or decorative particle cloud.
- Preserve all four primary destinations and evidence/status labels. Opening a page
  or seeing an explanation does not establish mastery.

## Motion contract

`signal-motion.js` adds illustrative packets to curated signal-flow paths. It never
changes experiment traces or storage. Probability densities and response plots stay
static. The overview's frequency components are schematic, not measured data.

One shared, capped 30 fps scheduler updates pre-created SVG circles using cached
geometry. Offscreen figures, hidden topic panels and background documents do not
animate. Reduced motion, print and the visible pause control are respected. No
pointer chasing, layout animation, random clouds, dependencies or network requests.
Preserve SVG source attributes used as motion selectors; theme them through CSS.

## Maintenance

Production pages carry the `math-studio` body class and load `signal-studio.css`
last, after legacy page-specific styles and `signal-design.css`. Legacy styles stay
available for compatibility; the final scoped stylesheet owns the visual identity.
Use `color-scheme: light`. Every embedded simulator receives the same theme.

Keep `index.html` and `knowledge.html` identical. Keep the shared header class
`lab-site-header architecture-header` for generator extraction. Changes to generated
pages must be accompanied by their source/template changes. Rebuild with:

```
python build-exploration.py
python build-engineering-cases.py
python build-next-learning.py
```

The preview URLs remain a design reference; production navigation uses actual routes.
Learning updates follow `README-learning.md`. Do not put visual logic in the learning
progress or simulation-routing engines and do not rewrite manual progress on updates.

Before a release, compare nonvisual lesson content, links, IDs, data attributes,
calculations and state/security logic against the base. Run numerical, learning,
question-helper, generator, simulation-history and motion-lifecycle regressions.
Check every production page and knowledge reading view at desktop and narrow widths,
including diagrams, keyboard focus, disclosures, Back/Forward, deep links, reduced
motion, pause controls and all three simulator iframe engines.
