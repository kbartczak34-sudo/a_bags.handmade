# Photo-based bow seating — 31 October 2026

This pass compares the six original supplied photographs with native GLES renders
of the actual configurator geometry and shaders. It retains the preceding body,
wood handle, cord gauge and textile print calibrations.

| Reference | Visible tie and fabric detail |
| --- | --- |
| `1000019645.png`, ocean | Knot sits above the front rim; the lower wooden ring remains covered in green cord. |
| `1000019552.jpg`, navy | Knot sits lower on the left bound arm; broad pink wings and long unequal tails. |
| `1000019407.png`, cacao/cream | Lower tie, wider pale wings and a separate olive/brown gathered band. |
| `1000019121.jpg`, pastel tote | Tie follows the lower corner of the D-shaped handle; tall floral wings and a left tail reaching close to the body base. |
| `1000018863(3).jpg`, rose/cream | Tie follows the lower D-shaped corner; full peony wings and a separate burgundy band. |
| `1000019763.png`, chocolate | The bow stays on the body rather than gaining a wooden-handle mount. |

The model registry retains its earlier `.jpg` reference labels for the ocean and
chocolate variants; the originals recovered for this comparison are PNGs with
the same numerical stems.

Each wooden reference has a tie offset relative to the handle's leftmost point.
The knot anchor and surrounding cuff use the same handle frame and actual
round/D-shaped centreline. The cuff around the broad wooden ring has a rounded
rectangular section. Where the photographed tie lies on cord-covered wood, it
also clears the existing winding envelope, including the cloth's inner face.
Generic round wooden handles keep their original circular cuff.

Reference wing heights, unequal tail lengths and knot band widths are visual
proportions from these views. Rose and cacao use a separately dyed satin mesh
for the gathered band; the other references retain printed fabric there. The
geometry cache includes handle shape and tie position for both bow and scarf
selections, so changing a colour reference cannot retain a stale attachment.

`tests/reference-bow-seating.test.mjs` checks shared anchors, cuff closure,
distance from actual wood triangles and existing cord segments, broad wings,
tail clearance above the body base, band selection and GPU resource replacement.
The generic round-handle checks remain in `ornament-folds-and-clearance.test.mjs`.

These are reference-based refinements, not a verified 1:1 digital twin. The cloth
prints are still reconstructed approximations; only approximately 16 cm body
width is confirmed. No unseen dimensions are inferred as physical measurements.
