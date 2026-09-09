# A-Bags Digital Twin — Asset Production Specification

## Purpose

This document defines the production acceptance contract for the first real A-Bags 3D Digital Twin asset. The renderer must not treat a procedural or placeholder mesh as an exact product model.

## Required package

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

The GLB must contain separate meshes named exactly:

- `body`
- `flap`
- `handles`
- `strap`
- `hardware`
- `accessories`

## Geometry acceptance

- Real product proportions must be derived from measured product dimensions whenever available.
- Bag body, rim, flap, handles and attachment points must be modeled as physical geometry rather than painted silhouettes.
- Crochet/crocheted-cord relief must be represented through material/normal/detail treatment; a flat color-only surface is not sufficient for the production Digital Twin.
- Hidden geometry must not be invented and presented as verified 1:1 geometry. Where photographs do not expose a surface, the implementation must document the assumption.
- UVs must be stable and non-overlapping for all textured surfaces unless intentional mirrored/reused UVs are documented.

## Material acceptance

Base color is sRGB. Normal, roughness, metallic and AO are linear/non-color data.

The production material pipeline supports:

- BaseColor
- Normal
- Roughness
- Metallic
- AO
- optional Clearcoat
- optional Sheen
- optional Height

Crochet cord should use the `cord` material profile. Wood handles should use `wood`. Metal fittings should use `metal`. Leather/suede/satin components should use their corresponding profiles.

## Reference evidence

The supplied product photographs establish visible characteristics including crochet construction, lining patterns, wooden handle appearance, hardware, straps and accessories. They do **not** by themselves establish exact hidden dimensions, backside geometry, internal topology or every attachment point.

Therefore the production acceptance rule is: **photographic fidelity for visible evidence + measured dimensions for scale + explicit documentation for unavoidable assumptions.**

## Model IDs

Model IDs are immutable. A revised physical model must receive a new model ID and must not silently replace an existing production asset.

Initial planned families:

- `abags-tote-v1`
- `abags-round-v1`
- `abags-bucket-v1`
- `abags-mini-v1`

## QA gate

A model is production-ready only when:

1. `model.glb` exists at the contract path.
2. All five PBR texture maps exist at the contract paths.
3. All six required mesh names exist in the GLB.
4. UVs and texture color spaces are valid.
5. The asset loads through `BagBuilder3DEnhancer` without fallback.
6. Realtime accessory anchoring passes.
7. Desktop and mobile browser QA pass.
8. The model is not represented as an exact 1:1 Digital Twin unless the geometry and dimensions have been sufficiently evidenced.
