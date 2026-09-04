import "./bag-builder-reference-v4.css";
import "./bag-builder-reference-v4-final.css";
import "./bag-builder-reference-v4-product-stage.css";
import "./bag-builder-photo-true.css";
import "./bag-builder-photo-true-option-truth.css";
import "./bag-builder-mobile-shell-fix.css";
import "./bag-builder-customer-realtime.css";
import BagBuilderAutosave from "./bag-builder-autosave";
import BagBuilderCheckoutHandoff from "./bag-builder-checkout-handoff";
import BagBuilderCommerce from "./bag-builder-commerce";
import BagBuilderEngine from "./bag-builder-engine";
import BagBuilderFidelity3D from "./bag-builder-fidelity3d";
import BagBuilderMaterialInfo from "./bag-builder-material-info";
import BagBuilderPhotoTrue from "./bag-builder-photo-true";
import BagBuilderPhotoTrueFlowGuard from "./bag-builder-photo-true-flow-guard";
import BagBuilderPhotoTrueGate from "./bag-builder-photo-true-gate";
import BagBuilderPhotoTrueOptionTruth from "./bag-builder-photo-true-option-truth";
import BagBuilderPremiumCompat from "./bag-builder-premium-compat";
import BagBuilderPro3DTouchRescue from "./bag-builder-pro3d-touch-rescue";
import BagBuilderProjectReview from "./bag-builder-project-review";
import BagBuilderReferenceExperience from "./bag-builder-reference-experience";
import BagBuilderReferenceHeaderGuard from "./bag-builder-reference-header-guard";
import BagBuilderReferenceLayoutV3 from "./bag-builder-reference-layout-v3";
import BagBuilderReferenceV4 from "./bag-builder-reference-v4";
import BagBuilderRendererFallback from "./bag-builder-renderer-fallback";
import BagBuilderShareLink from "./bag-builder-share-link";
import BagBuilderValidationGuard from "./bag-builder-validation-guard";
import BagBuilderViewSync from "./bag-builder-view-sync";

export default function ExactLiveCustomizer() {
  return <>
    <BagBuilderEngine />
    <BagBuilderFidelity3D />
    <BagBuilderPro3DTouchRescue />
    <BagBuilderRendererFallback />
    <BagBuilderPremiumCompat />
    <BagBuilderViewSync />
    <BagBuilderCommerce />
    <BagBuilderReferenceExperience />
    <BagBuilderReferenceLayoutV3 />
    <BagBuilderReferenceHeaderGuard />
    <BagBuilderReferenceV4 />
    <BagBuilderPhotoTrueGate>
      <BagBuilderPhotoTrue />
      <BagBuilderPhotoTrueFlowGuard />
      <BagBuilderPhotoTrueOptionTruth />
    </BagBuilderPhotoTrueGate>
    <BagBuilderMaterialInfo />
    <BagBuilderValidationGuard />
    <BagBuilderAutosave />
    <BagBuilderProjectReview />
    <BagBuilderShareLink />
    <BagBuilderCheckoutHandoff />
  </>;
}
