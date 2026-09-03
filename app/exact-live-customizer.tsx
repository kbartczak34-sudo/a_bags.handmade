import AtelierBagRendererV7 from "./atelier-bag-renderer-v7";
import BagBuilderCanvas3D from "./bag-builder-canvas3d";
import BagBuilderCanvas3DTouchRescue from "./bag-builder-canvas3d-touch-rescue";
import BagBuilderEngine from "./bag-builder-engine";
import BagBuilderPro3D from "./bag-builder-pro3d";

export default function ExactLiveCustomizer() {
  return <>
    <BagBuilderEngine />
    <AtelierBagRendererV7 />
    <BagBuilderPro3D />
    <BagBuilderCanvas3D />
    <BagBuilderCanvas3DTouchRescue />
  </>;
}
