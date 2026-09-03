import AtelierBagRendererV7 from "./atelier-bag-renderer-v7";
import BagBuilderAtelier3D from "./bag-builder-atelier3d";
import BagBuilderCanvas3D from "./bag-builder-canvas3d";
import BagBuilderCanvas3DTouchRescue from "./bag-builder-canvas3d-touch-rescue";
import BagBuilderCommerce from "./bag-builder-commerce";
import BagBuilderEngine from "./bag-builder-engine";
import BagBuilderMaterialPass from "./bag-builder-material-pass";
import BagBuilderPro3DTouchRescue from "./bag-builder-pro3d-touch-rescue";
import BagBuilderReferenceExperience from "./bag-builder-reference-experience";

export default function ExactLiveCustomizer() {
  return <>
    <BagBuilderEngine />
    <AtelierBagRendererV7 />
    <BagBuilderAtelier3D />
    <BagBuilderPro3DTouchRescue />
    <BagBuilderCanvas3D />
    <BagBuilderCanvas3DTouchRescue />
    <BagBuilderMaterialPass />
    <BagBuilderCommerce />
    <BagBuilderReferenceExperience />
  </>;
}
