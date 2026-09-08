# A-Bags 3D asset contract

Each bag model is stored under `public/3d/bags/MODEL-ID/`.

Required files:

- `model.glb` — glTF 2.0 binary model.
- `textures/basecolor.webp` — sRGB base color.
- `textures/normal.webp` — tangent-space normal map.
- `textures/roughness.webp` — linear roughness map.
- `textures/metallic.webp` — linear metallic map.
- `textures/ao.webp` — linear ambient-occlusion map.

Recommended GLB mesh names for the configurator:
`body`, `flap`, `handles`, `strap`, `hardware`, `accessories`.

Additional `clearcoat`, `sheen` and `height` maps can be introduced in the next material-fidelity stage without changing this base contract.
