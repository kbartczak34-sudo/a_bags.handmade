import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";
import { isAdminEmail } from "../../lib/admin-auth";
import AdminPanel from "./admin-panel";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const user = await requireChatGPTUser("/panel");
  if (!isAdminEmail(user.email)) notFound();

  return <AdminPanel ownerName={user.fullName ?? "Klaudia"} />;
}
