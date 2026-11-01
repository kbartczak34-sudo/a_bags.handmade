# Sidewall stitch orientation — 1 November 2026

The old unrolled gusset mapped the horizontal stitch axis around the entire
body contour and the vertical axis across the bag's depth. After a quarter turn,
classic loops therefore appeared as broad horizontal Xs, unlike the upright
loops visible at the sides of the supplied chocolate and ocean references.

The gusset now places columns across the depth and rows along the body contour.
Their physical spacing comes from the same front-panel gauge for the selected
stitch. The local row direction follows the contour so both sidewalls point
the V crowns toward the base. The orientation meets underneath the bag, where
the sidewall runs turn around the lower contour. The upper contour remains open.

The same mapping applies to classic, herringbone, basket and shell geometry in
all seven families. Classic, herringbone and shell retain their respective loop
paths; basket retains its over/under weave. Front, back, flap and rim paths are
unchanged. Yarn cross-sections, arc-length fibre UVs, contact occlusion and
deterministic hand tension remain attached to the physical cords.

Six centreline steps and eight sides on each gusset tube keep all 28
family/stitch meshes inside the WebGL 1 unsigned-short vertex budget. No new
draw calls or GPU buffers are added, and recolouring/orbiting still reuse the
existing mesh cache.

`tests/gusset-stitch-direction.test.mjs` inspects actual cord paths on both
sidewalls. It checks that loop shoulders sit above their tips, compares height
and width with the front at the same selected gauge, and verifies round nominal
5 mm cord. Shell's outer fan and inner loop are compared as separate size
classes. Existing cylindrical-yarn and surface-continuity tests also check
all family/stitch meshes for valid indices, finite geometry and unit normals.

Native GLES renders compare the same source models before and after, including
both side views and all four stitches. This corrects stitch orientation; it
does not establish measured dimensions or a verified 1:1 underside construction.
