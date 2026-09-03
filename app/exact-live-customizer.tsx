import BagBuilderAutosave from "./bag-builder-autosave";
import BagBuilderCheckoutHandoff from "./bag-builder-checkout-handoff";
import BagBuilderCommerce from "./bag-builder-commerce";
import BagBuilderEngine from "./bag-builder-engine";
import BagBuilderFidelity3D from "./bag-builder-fidelity3d";
import BagBuilderMaterialInfo from "./bag-builder-material-info";
import BagBuilderPro3DTouchRescue from "./bag-builder-pro3d-touch-rescue";
import BagBuilderProjectReview from "./bag-builder-project-review";
import BagBuilderReferenceExperience from "./bag-builder-reference-experience";
import BagBuilderReferenceLayoutV2 from "./bag-builder-reference-layout-v2";
import BagBuilderShareLink from "./bag-builder-share-link";
import BagBuilderValidationGuard from "./bag-builder-validation-guard";
import BagBuilderViewSync from "./bag-builder-view-sync";

export default function ExactLiveCustomizer() {
  return <>
    <BagBuilderEngine />
    <BagBuilderFidelity3D />
    <BagBuilderPro3DTouchRescue />
    <BagBuilderViewSync />
    <BagBuilderCommerce />
    <BagBuilderReferenceExperience />
    <BagBuilderReferenceLayoutV2 />
    <BagBuilderMaterialInfo />
    <BagBuilderValidationGuard />
    <BagBuilderAutosave />
    <BagBuilderProjectReview />
    <BagBuilderShareLink />
    <BagBuilderCheckoutHandoff />
  </>;
}
