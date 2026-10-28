# Reference textile assets for all models

These are generated approximations of the textile designs in the supplied
photographs, not scans of Agata's fabric or exact production patterns.
All six reference scarves, floral webbing, the cognac jacquard and the ocean
striped webbing now use their own images. Optional custom scarves use the
nearest reference palette; crochet, leather, tassels and chains keep their own materials.
The bag, ribbon folds, webbing, seams and hardware remain editable 3D geometry.

Generated with the built-in image generator on 28 October 2026. The reference
photograph served as the pattern guide. Production JPEGs are encoded at quality
84 with chroma subsampling; originals remain in the generation output.

| Asset | Size | Purpose |
| --- | --- | --- |
| `public/images/configurator/textiles/rose-peony-satin-v1.jpg` | 1024 × 1024 | Watercolor peony scarf albedo |
| `public/images/configurator/textiles/raspberry-botanical-webbing-v1.jpg` | 512 × 512 | Dense raspberry botanical webbing albedo |
| `public/images/configurator/textiles/chocolate-mauve-satin-v1.jpg` | 1024 × 1024 | Mauve botanical scarf for `1000019763.png` |
| `public/images/configurator/textiles/ocean-leaves-satin-v1.jpg` | 1024 × 1024 | Aqua and yellow foliage for `1000019645.png` |
| `public/images/configurator/textiles/navy-meadow-satin-v1.jpg` | 1024 × 1024 | Blush daisies and blue meadow flowers for `1000019552.jpg` |
| `public/images/configurator/textiles/cacao-bouquets-satin-v1.jpg` | 1024 × 1024 | Sparse orange bouquets for `1000019407.png` |
| `public/images/configurator/textiles/pastel-bouquets-satin-v1.jpg` | 1024 × 1024 | Dense pink bouquets and teal foliage for `1000019121.jpg` |
| `public/images/configurator/textiles/copper-jacquard-webbing-v1.jpg` | 512 × 512 | Black, ivory and copper geometric rosettes for the cognac satchel |
| `public/images/configurator/textiles/natural-striped-webbing-v1.jpg` | 512 × 512 | Grey, sand and ivory woven stripes for the ocean tote |

`lib/abags-textile-profiles.ts` selects the image and physical UV scale for each
model. `lib/abags-printed-textiles.ts` reuses two WebGL texture objects, loads only
the selected scarf and strap and rejects stale callbacks when switching models.
Power-of-two mipmaps keep the print filtered during rotation and zoom. A selected
reference model downloads at most 500 KB of print assets; the catalog is not
eagerly loaded. The original procedural materials remain the loading/error fallback.

## Prompts

Each image was generated separately with the built-in image generator. The
reference photographs guided the fabric patterns; the images are flat albedo
tiles, with no bags, hardware, folds, scene shadows, typography, logo or watermark.
The existing 3D cloth supplies the folds and lighting. Additional prompt briefs:

- Chocolate: warm ivory satin with large botanical hibiscus outlines, dusty mauve,
  grey-violet petals and muted leaves; organically arranged seamless textile print.
- Ocean: turquoise/aqua ground, finely drawn yellow and mint fern fronds and leaf
  sprigs; delicate airy botanical scarf print, flat and evenly lit.
- Navy: blush pink satin with irregular white daisies, yellow centres, tiny blue
  forget-me-nots and sage/olive foliage; small romantic meadow bouquets.
- Cacao: pale peach ivory satin, sparse tiny orange/ochre bouquets, violet buds,
  olive leaves and fine stems; open background and subtle ink shading.
- Pastel: dense coral, pink and peach flower bouquets with dark teal leaves on
  ivory; small varied flowers rather than isolated circular icons.
- Jacquard: black woven band with ivory angular diamonds and copper/orange rosettes,
  repeated horizontally; detailed interlaced threads, flat even lighting.
- Striped: woven grey, sand/tan and ivory parallel bands running horizontally across
  the tile, realistic fine threads; no perspective or pre-baked scene shadows.

Scarf: square, flat albedo texture for the reference satin scarf; large soft
watercolor pink peonies with many irregular overlapping petals, creamy ivory
negative space, muted olive/lime leaves, thin curving stems and occasional pale
pink buds. Botanical fabric print with translucent ink and painterly petal
shading, organically arranged as a seamless tile. Even lighting, no bag, bow
silhouette, fold shadows, scene, typography, border or logo. Avoid circular
flower icons.

Webbing: square, flat albedo texture for the reference shoulder strap; dense
raspberry/fuchsia botanical toile on warm ivory, fine scrolling peony petals,
leaves, slender vines and decorative sprigs. Sophisticated single-ink textile
pattern with fine woven texture, organically arranged as a seamless tile. Even
lighting, no bag, strap silhouette, hardware, fold shadows, scene, typography,
border or logo. Avoid chunky daisies and isolated flower icons.
