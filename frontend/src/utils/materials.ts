const ABBREVIATIONS: Record<string, string> = {
  "lamp": "lampada",
  "lamp.": "lampada",
  "arg.": "argamassa"
};

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((chunk) => ABBREVIATIONS[chunk] ?? chunk)
    .join(" ");
}

export function parseMaterialsInput(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function formatPrice(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency
  }).format(value);
}
