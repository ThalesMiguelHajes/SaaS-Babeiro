import { redirect } from "next/navigation";

import { getCurrentUser, isPlatformAdmin, listMyMemberships } from "@/lib/authz";
import { resolveHomePath } from "@/modules/auth/rules";

/** Raiz: envia cada usuário para a sua área (MASTER_PLAN §2.4). */
export default async function HomePage() {
  if (!(await getCurrentUser())) redirect("/login");
  const [admin, memberships] = await Promise.all([isPlatformAdmin(), listMyMemberships()]);
  redirect(resolveHomePath({ isPlatformAdmin: admin, memberships }));
}
