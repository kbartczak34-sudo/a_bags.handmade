import AtelierBagRendererV7 from "./atelier-bag-renderer-v7";
import BagBuilderCanvas3D from "./bag-builder-canvas3d";
import BagBuilderEngine from "./bag-builder-engine";
import BagBuilderPro3D from "./bag-builder-pro3d";

export default function ExactLiveCustomizer() {
  return <>
    <BagBuilderEngine />
    <AtelierBagRendererV7 />
    <BagBuilderPro3D />
    <BagBuilderCanvas3D />
  </>;
}
