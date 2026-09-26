// app/admin/ai/page.tsx
import { redirect } from "next/navigation";

export default function AdminAIRedirectPage() {
  redirect("/admin/settings?tab=ai");
}