import AtelierBagRendererV7 from "./atelier-bag-renderer-v7";
import BagBuilderEngine from "./bag-builder-engine";
import BagBuilderReal3D from "./bag-builder-real3d";

export default function ExactLiveCustomizer() {
  return <>
    <BagBuilderEngine />
    <AtelierBagRendererV7 />
    <BagBuilderReal3D />
  </>;
}
