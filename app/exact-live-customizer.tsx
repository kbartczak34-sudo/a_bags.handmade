import AtelierBagRendererV7 from "./atelier-bag-renderer-v7";
import BagBuilderCanvas3D from "./bag-builder-canvas3d";
import BagBuilderCanvas3DTouchRescue from "./bag-builder-canvas3d-touch-rescue";
import BagBuilderCommerce from "./bag-builder-commerce";
import BagBuilderConstructionPass from "./bag-builder-construction-pass";
import BagBuilderEngine from "./bag-builder-engine";
import BagBuilderFidelity3D from "./bag-builder-fidelity3d";
import BagBuilderMaterialPass from "./bag-builder-material-pass";
import BagBuilderPro3DTouchRescue from "./bag-builder-pro3d-touch-rescue";
import BagBuilderReferenceExperience from "./bag-builder-reference-experience";
import BagBuilderViewSync from "./bag-builder-view-sync";

export default function ExactLiveCustomizer() {
  return <>
    <BagBuilderEngine />
    <AtelierBagRendererV7 />
    <BagBuilderFidelity3D />
    <BagBuilderPro3DTouchRescue />
    <BagBuilderCanvas3D />
    <BagBuilderCanvas3DTouchRescue />
    <BagBuilderMaterialPass />
    <BagBuilderConstructionPass />
    <BagBuilderViewSync />
    <BagBuilderCommerce />
    <BagBuilderReferenceExperience />
  </>;
}
