"use client";

import { FormEvent, useEffect, useState } from "react";

type StepType = "CROCHET" | "JOIN" | "ATTACH" | "SEW" | "FINISH" | "QC";
type Slot = "flap" | "handles" | "strap" | "hardware" | "accent";
type StepDraft = { key: string; stepType: StepType; appliesToSlot: Slot | ""; instruction: string; qcCriterion: string };
type Recipe = {
  id: string;
  bagFamily: string;
  stitchPatternId: string;
  version: number;
  name: string;
  status: "DRAFT" | "VALIDATED";
  steps: Array<{ id: string; stepOrder: number; stepType: StepType; appliesToSlot: Slot | null; instruction: string; qcCriterion: string }>;
};

const FAMILIES = ["tote", "round", "bucket", "mini"];
const STITCHES = ["classic", "herringbone", "basket", "shell"];
const STEP_TYPES: StepType[] = ["CROCHET", "JOIN", "ATTACH", "SEW", "FINISH", "QC"];
const SLOTS: Slot[] = ["flap", "handles", "strap", "hardware", "accent"];

function newStep(): StepDraft {
  return { key: crypto.randomUUID(), stepType: "CROCHET", appliesToSlot: "", instruction: "", qcCriterion: "" };
}

async function loadRecipes() {
  const response = await fetch("/api/admin/craft-production-recipes", { cache: "no-store" });
  const payload = await response.json() as { recipes?: Recipe[]; error?: string };
  if (!response.ok || !Array.isArray(payload.recipes)) throw new Error(payload.error || "Nie udało się wczytać receptur.");
  return payload.recipes;
}

export default function CraftProductionRecipeManager() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadRecipes().then((items) => { if (!cancelled) setRecipes(items); }).catch((error) => {
      if (!cancelled) setMessage(error instanceof Error ? error.message : "Nie udało się wczytać receptur.");
    });
    return () => { cancelled = true; };
  }, []);

  const patchStep = (key: string, patch: Partial<StepDraft>) => {
    setSteps((items) => items.map((step) => step.key === key ? { ...step, ...patch } : step));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/craft-production-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bagFamily: String(data.get("bagFamily") ?? ""),
          stitchPatternId: String(data.get("stitchPatternId") ?? ""),
          version: Number(data.get("version")),
          name: String(data.get("name") ?? ""),
          status: data.get("approved") === "on" ? "VALIDATED" : "DRAFT",
          steps: steps.map((step) => ({
            stepType: step.stepType,
            appliesToSlot: step.stepType === "ATTACH" ? step.appliesToSlot : null,
            instruction: step.instruction,
            qcCriterion: step.stepType === "QC" ? step.qcCriterion : "",
          })),
        }),
      });
      const payload = await response.json() as { recipe?: Recipe; error?: string };
      if (!response.ok || !payload.recipe) throw new Error(payload.error || "Nie udało się zapisać receptury.");
      setRecipes(await loadRecipes());
      setSteps([]);
      form.reset();
      setMessage(payload.recipe.status === "VALIDATED" ? "Receptura produkcyjna zatwierdzona ✓" : "Receptura zapisana jako nowa wersja robocza.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać receptury.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="builder-admin-card" data-craft-production-recipe-manager>
    <header className="builder-admin-heading">
      <div>
        <p className="eyebrow">Digital Craft Twin · Production Recipe</p>
        <h2>Receptura wykonania i kontroli jakości</h2>
        <p>Twórz wersjonowane instrukcje pracowni dla konkretnego fasonu i ściegu. System nie generuje kroków z podglądu 3D i nie dopisuje instrukcji za Agatę.</p>
      </div>
    </header>

    <div className="builder-admin-note">
      <strong>Zatwierdzonej wersji nie edytujemy w miejscu.</strong>
      <p>Każda zmiana procesu powinna powstać jako kolejny numer wersji. Receptura VALIDATED wymaga CROCHET, FINISH, QC z kryterium oraz jawnego ATTACH dla hardware.</p>
    </div>

    <form onSubmit={save}>
      <div className="builder-admin-grid">
        <label><span>Fason</span><select name="bagFamily" required defaultValue=""><option value="" disabled>Wybierz fason</option>{FAMILIES.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Ścieg</span><select name="stitchPatternId" required defaultValue=""><option value="" disabled>Wybierz ścieg</option>{STITCHES.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Wersja</span><input name="version" type="number" min="1" step="1" required /></label>
        <label><span>Nazwa receptury</span><input name="name" required placeholder="np. Tote / classic / proces bazowy" /></label>
      </div>

      <div className="builder-admin-section">
        <h3>Kroki produkcyjne</h3>
        {steps.length === 0 && <div className="builder-admin-note"><p>Brak kroków. Dodaj je w rzeczywistej kolejności wykonania.</p></div>}
        {steps.map((step, index) => <div className="builder-admin-note" key={step.key}>
          <strong>Krok {index + 1}</strong>
          <div className="builder-admin-grid">
            <label><span>Typ</span><select value={step.stepType} onChange={(event) => patchStep(step.key, { stepType: event.target.value as StepType, appliesToSlot: "", qcCriterion: "" })}>{STEP_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label>
            {step.stepType === "ATTACH" && <label><span>Slot akcesorium</span><select required value={step.appliesToSlot} onChange={(event) => patchStep(step.key, { appliesToSlot: event.target.value as Slot })}><option value="" disabled>Wybierz slot</option>{SLOTS.map((value) => <option key={value}>{value}</option>)}</select></label>}
            <label><span>Instrukcja pracowni</span><textarea required value={step.instruction} onChange={(event) => patchStep(step.key, { instruction: event.target.value })} /></label>
            {step.stepType === "QC" && <label><span>Kryterium QC</span><textarea value={step.qcCriterion} onChange={(event) => patchStep(step.key, { qcCriterion: event.target.value })} placeholder="Wpisz mierzalne kryterium kontroli" /></label>}
          </div>
          <button type="button" onClick={() => setSteps((items) => items.filter((item) => item.key !== step.key))}>Usuń krok</button>
        </div>)}
        <button type="button" onClick={() => setSteps((items) => [...items, newStep()])}>+ Dodaj krok</button>
      </div>

      <label className="builder-admin-checkbox"><input type="checkbox" name="approved" /><span>Agata zatwierdziła tę wersję jako rzeczywistą recepturę produkcyjną i QC</span></label>
      <div className="builder-admin-actions"><button type="submit" disabled={busy}>{busy ? "Zapisywanie…" : "Zapisz nową wersję receptury"}</button></div>
    </form>

    {recipes.length > 0 && <div className="builder-admin-section">
      <h3>Zapisane receptury</h3>
      {recipes.map((recipe) => <div className="builder-admin-note" key={recipe.id}>
        <strong>{recipe.bagFamily} · {recipe.stitchPatternId} · v{recipe.version} · {recipe.status}</strong>
        <p>{recipe.name} · {recipe.steps.length} kroków</p>
      </div>)}
    </div>}

    {message && <footer className="builder-admin-actions"><span>{message}</span></footer>}
  </section>;
}
