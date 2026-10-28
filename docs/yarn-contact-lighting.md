# Cord lighting and contact depth

The editable WebGL model uses three complementary levels of detail:

- Real round cord geometry with slight, deterministic changes in tension and
  carrier phase for separate lengths of yarn. The physical 5 mm gauge and the
  original stitch paths are retained.
- A filtered directional reflection follows the cord's physical UV tangent.
  Dyed-fibre sheen retains the selected yarn hue, reducing the grey coating
  previously visible on dark navy and brown materials.
- Neutral contact visibility is baked from nearby cord capsule segments on the
  front, back, gusset and crocheted flap. This is a bounded approximation of
  local occlusion, rather than ray-traced lighting or photographic reconstruction.

The contact bake runs at GPU upload when a construction changes; pure geometry
generation does not pay the shading cost. A spatial grid restricts
queries to nearby segments, and one cord contributes at most once to each probe,
so curve subdivision does not artificially darken the result. Visibility is
bounded to 0.40–1.00; the outward crowns remain exposed to light. The back panel
shares the mirrored front panel's visibility, matching the confirmed construction.

The UV buffer carries fabric U/V in its first two components and visibility in
the third. Other materials receive a neutral value of one. This adds no draw
calls, texture downloads, WebGL attribute locations or GPU buffers. GPU memory
increases by one float per vertex. Rotation, zoom and recoloring reuse the bake.

WebGL 1 devices without standard derivatives retain filtered matte cord and the
same contact visibility. The existing wood, metal, leather and printed textile
materials retain their own shading. Prints and saved configurations are unchanged.

Validation covers contact against an isolated strand, subdivision invariance,
the packed GPU UV contract, repeatable independent carrier phases, all family/
stitch geometry, filtered shader rendering and real browser model interactions.
Visual review uses native GLES renders from the application renderer.

The renderer remains an approximation of Agata's photographs. Only the approximate
16 cm body width is confirmed; unmeasured height/depth and microscopic yarn details
must not be presented as exact measurements or a 1:1 reconstruction.
