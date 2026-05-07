export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function extractUnit(name: string): string | null {
  const n = name.toLowerCase();
  if (/\d+\s*kg/.test(n)) return "KG";
  if (/\d+\s*(litro|lt\b|l\b)/.test(n)) return "L";
  if (/\d+\s*ml/.test(n)) return "ML";
  if (/\d+\s*m²/.test(n)) return "M²";
  if (/\d+\s*m\b/.test(n)) return "M";
  if (/\b(cx|caixa)\b/.test(n)) return "CX";
  if (/\b(sc|saco)\b/.test(n)) return "SC";
  if (/\b(pc|peça|peca)\b/.test(n)) return "PC";
  return null;
}
