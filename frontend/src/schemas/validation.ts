import { z } from "zod";

// Supplier validation schema
export const supplierSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  url: z.string().url("URL inválida"),
  logo: z.string().optional(),
  requiresLogin: z.boolean(),
  username: z.string().optional(),
  password: z.string().optional(),
  region: z.string().optional(),
  notes: z.string().optional()
}).refine((data) => {
  if (data.requiresLogin && !data.username) {
    return false;
  }
  return true;
}, {
  message: "Usuário é obrigatório quando requer login",
  path: ["username"]
});

export type SupplierFormData = z.infer<typeof supplierSchema>;

// Product validation schema
export const productSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  category: z.string().min(2, "Categoria deve ter no mínimo 2 caracteres"),
  sku: z.string().optional(),
  logo: z.string().optional(),
  notes: z.string().optional()
});

export type ProductFormData = z.infer<typeof productSchema>;

// Login validation schema
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres")
});

export type LoginFormData = z.infer<typeof loginSchema>;
