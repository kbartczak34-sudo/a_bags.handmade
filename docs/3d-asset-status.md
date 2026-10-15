# A-Bags 3D asset status

The Three.js production contract is implemented, but the final 1:1 atelier GLB and calibrated PBR texture set must be supplied from the actual bag source asset.

Required per model:
- model.glb
- textures/basecolor.webp
- textures/normal.webp
- textures/roughness.webp
- textures/metallic.webp
- textures/ao.webp

The configurator must not claim photographic/physical 1:1 fidelity until those binary assets are validated against the real product.

## Measurements confirmed with Agata (October 2026)
- Approximate physical **body width: 16 cm** for each currently offered bag family. This is a *nominal, approximate* external width, NOT an exact tolerance-qualified dimension or a handle/strap span.
- Back of the crocheted body: **the same construction and pattern as the front**. Render both sides with equal dome relief and backward-facing yarn normals; preserve actual selected hardware/flap where present.
- Physical height: **not supplied**.
- Physical front-to-back depth: **not supplied**.
- The existing renderer `rx`, `ry`, and `depth` values are design/world units, not validated centimetres. They MUST NOT be presented to buyers as measured dimensions.
- Use 16 cm as the width anchor when creating measured GLB assets later, but obtain height/depth and multi-angle source photos before claiming an exact 1:1 real-life digital twin.
