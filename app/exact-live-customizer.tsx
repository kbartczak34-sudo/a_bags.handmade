import AtelierBagRendererV7 from "./atelier-bag-renderer-v7";
import BagBuilderEngine from "./bag-builder-engine";
import BagBuilderWebGL3D from "./bag-builder-webgl3d";

export default function ExactLiveCustomizer() {
  return <>
    <BagBuilderEngine />
    <AtelierBagRendererV7 />
    <BagBuilderWebGL3D />
  </>;
}
