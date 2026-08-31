# SAPIO Spatial Discovery UI

SAPIO home is a two-dimensional cultural discovery field rather than a standard vertical feed.

## Eight directional lanes
- N — Future / Signal: SIGNAL LAB, IGNITION
- NE — Design / Style: VISUAL CORTEX, APPETITE
- E — Desire / Products: OBJECTS OF DESIRE, APPETITE
- SE — Eros / Nightlife: EROS INDEX, APPETITE
- S — Body / Soma: SOMA, EROS INDEX
- SW — Arcana / Inner World: ARCANA, SOMA
- W — World / Pulse: THE PULSE, IGNITION
- NW — Earth / Nature: TERRA, VERDANT

Moving farther from center increases the specificity of the directional lane. The center remains balanced.

## Interaction
- Drag/pan with mouse or touch.
- Two-dimensional trackpad scrolling moves the camera.
- Arrow keys move cardinally; Q/E/Z/C move diagonally.
- An on-screen 8-way compass provides explicit touch/click navigation.
- Clicking a card opens a preview.
- Preview can open the original source or enter a standard focused timeline.
- Focused timeline ranks by shared categories and title/summary language with the selected card.

## Persistence
- Unsaved and unliked cards leave the active experience after 24 hours.
- Saved and liked cards remain retained in private local Memory.
- When `DATABASE_URL` is available, Neon stores feed snapshots and timeline renewal events.
- Feed reads renew a stale snapshot after 15 minutes; the scheduled collector remains a secondary renewal path.
