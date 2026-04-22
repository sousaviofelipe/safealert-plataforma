import { Request, Response } from "express";
import { supabase } from "../supabase";

// Gera email fictício interno baseado no CPF
function cpfToEmail(cpf: string): string {
  const cleanCpf = cpf.replace(/\D/g, "");
  return `${cleanCpf}@safealert.internal`;
}

// Gera senha temporária baseada no CPF (primeiros 6 dígitos + @Safe)
function generateTempPassword(cpf: string): string {
  const cleanCpf = cpf.replace(/\D/g, "");
  return `${cleanCpf.slice(0, 6)}@Safe`;
}

export async function createVictimWithAccess(req: Request, res: Response) {
  const {
    full_name,
    phone,
    email,
    address,
    birth_date,
    cpf,
    notes,
    photo_url,
    contacts,
  } = req.body;

  if (!full_name?.trim()) {
    res.status(400).json({ error: "Nome completo é obrigatório" });
    return;
  }

  if (!cpf?.trim()) {
    res
      .status(400)
      .json({ error: "CPF é obrigatório para criar acesso ao app" });
    return;
  }

  const cleanCpf = cpf.replace(/\D/g, "");
  if (cleanCpf.length !== 11) {
    res.status(400).json({ error: "CPF inválido" });
    return;
  }

  try {
    const operator = (req as any).user;
    const internalEmail = cpfToEmail(cleanCpf);
    const tempPassword = generateTempPassword(cleanCpf);

    // 1. Cria usuário no Supabase Auth com email fictício e senha temporária
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: internalEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
          role: "victim",
          cpf: cleanCpf,
        },
      });

    if (authError) {
      res
        .status(400)
        .json({ error: "Erro ao criar acesso: " + authError.message });
      return;
    }

    // 2. Cria perfil da vítima
    const { data: victim, error: victimError } = await supabase
      .from("victims")
      .insert({
        full_name: full_name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        birth_date: birth_date || null,
        cpf: cleanCpf,
        notes: notes?.trim() || null,
        photo_url: photo_url || null,
        auth_user_id: authData.user.id,
        app_access_enabled: true,
        created_by: operator.id,
      })
      .select()
      .single();

    if (victimError) {
      // Reverte criação do usuário auth se falhar
      await supabase.auth.admin.deleteUser(authData.user.id);
      res
        .status(500)
        .json({ error: "Erro ao cadastrar vítima: " + victimError.message });
      return;
    }

    // 3. Cadastra contatos de confiança
    if (contacts && contacts.length > 0) {
      const validContacts = contacts.filter(
        (c: any) => c.full_name?.trim() && c.phone?.trim(),
      );
      if (validContacts.length > 0) {
        await supabase.from("trusted_contacts").insert(
          validContacts.map((c: any) => ({
            victim_id: victim.id,
            full_name: c.full_name.trim(),
            phone: c.phone.trim(),
            relationship: c.relationship?.trim() || null,
          })),
        );
      }
    }

    res.status(201).json({
      victim,
      app_credentials: {
        login: cleanCpf,
        password: tempPassword,
        message: "Entregue essas credenciais pessoalmente para a vítima",
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
