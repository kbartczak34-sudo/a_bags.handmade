# A-Bags Handmade — production 3D asset contract

Each production bag model lives in its own stable model directory:

```text
public/3d/bags/MODEL-ID/
├── model.glb
└── textures/
    ├── basecolor.webp
    ├── normal.webp
    ├── roughness.webp
    ├── metallic.webp
    └── ao.webp
```

## GLB mesh contract

The GLB should expose separate meshes (or named nodes) for:

- `body`
- `flap`
- `handles`
- `strap`
- `hardware`
- `accessories`

The separation is required so the configurator can swap construction components without duplicating geometry.

## Texture contract

- `basecolor.webp`: sRGB color data
- `normal.webp`: tangent-space normal data, non-color
- `roughness.webp`: linear scalar data, non-color
- `metallic.webp`: linear scalar data, non-color
- `ao.webp`: linear occlusion data, non-color

All maps must use the same production UV set unless a future model manifest explicitly declares otherwise.

## Material extensions

The material engine reserves support for `clearcoat`, `sheen` and `height` maps. They can be added without changing the base asset layout.

## Revision policy

`MODEL-ID` is immutable once deployed. A revised production model must receive a new stable model ID rather than overwriting an existing asset.
