import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { defaultAccounts, defaultCategories, defaultPlans } from "./setup.server";

/**
 * Cria o catálogo inicial do consultório: planos, contas financeiras e
 * categorias com grupo da DRE. Só o administrador pode executar e nada é
 * duplicado se já existir.
 */
export const seedCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas o administrador pode inicializar o catálogo.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Perfil não encontrado.");
    const orgId = profile.org_id;

    const created = { plans: 0, accounts: 0, categories: 0 };

    const { data: existingPlans } = await supabase.from("plans").select("id").limit(1);
    if ((existingPlans ?? []).length === 0) {
      const { error } = await supabase
        .from("plans")
        .insert(defaultPlans.map((p) => ({ ...p, org_id: orgId })));
      if (error) throw new Error(`Planos: ${error.message}`);
      created.plans = defaultPlans.length;
    }

    const { data: existingAccounts } = await supabase.from("financial_accounts").select("id, name");
    const accountRows = existingAccounts ?? [];
    const genericNubank = accountRows.find((account) => account.name === "Nubank");
    const hasNubankPf = accountRows.some((account) => account.name === "Nubank PF");
    if (genericNubank && !hasNubankPf) {
      const { error } = await supabase
        .from("financial_accounts")
        .update({ name: "Nubank PF" })
        .eq("id", genericNubank.id);
      if (error) throw new Error(`Conta Nubank: ${error.message}`);
      genericNubank.name = "Nubank PF";
    }
    const existingAccountNames = new Set(accountRows.map((account) => account.name));
    const missingAccounts = defaultAccounts.filter(
      (account) => !existingAccountNames.has(account.name),
    );
    if (missingAccounts.length > 0) {
      const { error } = await supabase
        .from("financial_accounts")
        .insert(missingAccounts.map((account) => ({ ...account, org_id: orgId })));
      if (error) throw new Error(`Contas: ${error.message}`);
      created.accounts = missingAccounts.length;
    }

    const { data: existingCategories } = await supabase.from("categories").select("id").limit(1);
    if ((existingCategories ?? []).length === 0) {
      const { error } = await supabase
        .from("categories")
        .insert(defaultCategories.map((c) => ({ ...c, org_id: orgId })));
      if (error) throw new Error(`Categorias: ${error.message}`);
      created.categories = defaultCategories.length;
    }

    return created;
  });

/** Renomeia o consultório. */
export const renameOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => {
    if (!input.name?.trim()) throw new Error("Informe o nome do consultório.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Perfil não encontrado.");
    const { error } = await supabase
      .from("organizations")
      .update({ name: data.name.trim() })
      .eq("id", profile.org_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
