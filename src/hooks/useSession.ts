import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/labels";

export type SessionInfo = {
  userId: string | null;
  email: string | null;
  fullName: string;
  orgName: string;
  roles: AppRole[];
};

async function loadSession(): Promise<SessionInfo> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return { userId: null, email: null, fullName: "", orgName: "", roles: [] };
  }

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, organizations(name)")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? null,
    fullName: profile?.full_name || (user.email ?? "").split("@")[0] || "Usuário",
    orgName: (profile?.organizations as { name: string } | null)?.name ?? "Meu Consultório",
    roles: (roles ?? []).map((r) => r.role as AppRole),
  };
}

export function useSession() {
  const query = useQuery({ queryKey: ["session"], queryFn: loadSession, staleTime: 60_000 });
  const roles = query.data?.roles ?? [];

  return {
    ...query,
    session: query.data,
    roles,
    isAdmin: roles.includes("admin"),
    canViewFinancial: roles.includes("admin") || roles.includes("financeiro"),
    canViewClinical:
      roles.includes("admin") || roles.includes("nutricionista") || roles.includes("estagiario"),
    canViewCommercial:
      roles.includes("admin") ||
      roles.includes("financeiro") ||
      roles.includes("atendimento") ||
      roles.includes("nutricionista"),
  };
}
