# A-Bags atelier interior reference contract

This document records the visual constraints established from the three supplied atelier photographs. It is a reference contract for future GLB modeling and visual QA.

## Interior construction

- The bag has a distinct fabric lining recessed below the crocheted upper rim.
- The lining follows the inside wall rather than being represented as a flat color patch.
- The upper crochet rim forms a continuous, thick finished edge around the opening.
- The visible interior depth must remain readable when the camera looks down into the bag.
- The brand label is a sewn rectangular fabric label positioned on the inner wall.

## Reference variants

### Red / dark wood variant

- Main body: saturated red crochet.
- Handles: dark brown polished wood, two separate curved handles.
- Lining: cream fabric with red/brown plaid grid.
- Hardware: warm gold.
- Decorative bow: floral/printed ribbon in cream, blush and red.
- Shoulder strap: wide woven strap with red, cream and tan vertical bands.

### Mauve / light wood variant

- Main body: mauve/purple crochet.
- Handles: light honey-colored wood, two separate curved handles.
- Lining: cream fabric with red/brown plaid grid.
- Hardware/details: light leather elements with warm metal accents.
- Decorative accessory: pale butterfly ornament.
- Additional upper decorative band is visible across the front.

### Cream / pink interior variant

- Main body: cream crochet.
- Interior flap: pink, smooth leather-like finish with stitched perimeter.
- Closure: gold-tone clasp mounted centrally on the flap.
- Lining: cream fabric with soft pink floral print and green foliage.
- Upper rim: cream braided/crocheted finish.
- Side hardware: gold-tone attachment rings.
- Decorative tassel: pink and cream strands.

## Modeling requirements

1. Interior wall and lining must be separate geometry/materials.
2. Flap must be a separate mesh and preserve its visible thickness and stitched edge.
3. Handles must be separate meshes with physically plausible attachment points.
4. Hardware must be separate meshes from textile geometry.
5. Accessories must be independently addressable so configurator selections do not require texture-baking the accessory into the body.
6. Crochet relief must be represented by validated geometry and/or normal/height detail; a blurred photographic texture alone is not accepted as a substitute for the stitch structure.
7. Hidden surfaces must not be invented as production truth until validated from physical references.

## Visual QA rule

A GLB may only be promoted to the production Digital Craft Twin after its exterior, opening, lining, flap, handle attachment, hardware and accessory placement have been compared against the supplied physical references. The supplied photographs establish appearance targets but do not by themselves prove unseen dimensions or backside geometry.
