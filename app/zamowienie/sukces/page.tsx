"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Confirmation = { id:string; paymentStatus:"paid"|"unpaid"|"no_payment_required"; status:string|null; amountTotal:number|null; currency:string|null; email:string|null };
type PageState = {kind:"loading"}|{kind:"success";confirmation:Confirmation}|{kind:"processing";confirmation:Confirmation}|{kind:"error";message:string};
const formatter=new Intl.NumberFormat("pl-PL",{style:"currency",currency:"PLN"});
const homeHref="/#kolekcja";

function ReturnActions(){return <div className="confirmation-return-actions"><Link className="primary-button" href={homeHref}>Wróć do strony głównej <span aria-hidden="true">→</span></Link><Link className="confirmation-secondary-link" href="/">Przejdź na początek strony</Link></div>}

export default function OrderSuccessPage(){
 const[state,setState]=useState<PageState>({kind:"loading"});
 useEffect(()=>{const checkPayment=async()=>{try{const sessionId=new URLSearchParams(window.location.search).get("session_id");if(!sessionId)throw new Error("Brakuje numeru potwierdzenia płatności.");const response=await fetch(`/api/checkout/session?session_id=${encodeURIComponent(sessionId)}`,{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error??"Nie udało się sprawdzić płatności.");const confirmation=data as Confirmation;if(confirmation.paymentStatus==="paid"||confirmation.paymentStatus==="no_payment_required"){window.localStorage.removeItem("abags-cart");setState({kind:"success",confirmation});}else setState({kind:"processing",confirmation});}catch(error){setState({kind:"error",message:error instanceof Error?error.message:"Nie udało się sprawdzić płatności."});}};void checkPayment();},[]);
 return <main className="confirmation-page">
  <style>{`.confirmation-return-actions{display:grid;gap:.75rem;width:100%;margin-top:.4rem}.confirmation-secondary-link{display:inline-flex;justify-content:center;align-items:center;min-height:44px;padding:.65rem 1rem;color:var(--ink);font:600 .78rem/1.2 var(--font-sans);text-decoration:underline;text-underline-offset:4px}.confirmation-home-hint{margin:.75rem 0 0;font-size:.76rem;opacity:.66}.confirmation-wordmark{cursor:pointer}`}</style>
  <Link className="wordmark confirmation-wordmark" href="/" aria-label="a_bags.handmade — wróć na stronę główną"><span>a_bags</span><small>handmade</small></Link>
  <section className="confirmation-card" aria-live="polite">
   {state.kind==="loading"&&<><span className="confirmation-mark loading-mark" aria-hidden="true">···</span><p className="eyebrow">Sprawdzamy płatność</p><h1>Jeszcze chwila…</h1><p>Bezpiecznie potwierdzamy status zamówienia w Stripe.</p></>}
   {state.kind==="success"&&<><span className="confirmation-mark" aria-hidden="true">✓</span><p className="eyebrow">Płatność potwierdzona</p><h1>Dziękujemy za zamówienie.</h1><p>Adres e-mail zamówienia: <strong>{state.confirmation.email}</strong>. Pracownia a_bags.handmade rozpocznie przygotowanie Twojej torebki.</p><div className="confirmation-details"><span>Zamówienie <strong>#{state.confirmation.id.slice(-8).toUpperCase()}</strong></span>{state.confirmation.amountTotal!==null&&<span>Zapłacono <strong>{formatter.format(state.confirmation.amountTotal/100)}</strong></span>}</div><ReturnActions/><p className="confirmation-home-hint">Powrót przeniesie Cię do kolekcji na stronie głównej.</p></>}
   {state.kind==="processing"&&<><span className="confirmation-mark loading-mark" aria-hidden="true">○</span><p className="eyebrow">Płatność w toku</p><h1>Czekamy na potwierdzenie.</h1><p>Bank lub Stripe nadal przetwarza płatność. Nie składaj ponownie zamówienia — o wyniku otrzymasz wiadomość e-mail.</p><ReturnActions/></>}
   {state.kind==="error"&&<><span className="confirmation-mark error-mark" aria-hidden="true">!</span><p className="eyebrow">Nie udało się potwierdzić</p><h1>Sprawdźmy to ponownie.</h1><p>{state.message} Jeśli środki zostały pobrane, skontaktuj się ze sklepem.</p><ReturnActions/></>}
  </section>
  <p className="confirmation-security">Bezpieczna płatność obsługiwana przez Stripe · BLIK · karta</p>
 </main>;
}
