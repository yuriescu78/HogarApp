interface AddShoppingFallback {
  tool:  'add_shopping_items';
  items: { name: string }[];
}

type FallbackResult = AddShoppingFallback | null;

// Matches: "añade X, Y y Z" / "agrega X" / "compra X"
const ADD_RE = /\b(a[ñn]ade?|agrega?|compra)\s+(.+)/i;

export function parseFallback(text: string): FallbackResult {
  const m = ADD_RE.exec(text);
  if (m) {
    const itemsRaw = m[2].split(/,| y /i).map(s => s.trim()).filter(Boolean);
    return { tool: 'add_shopping_items', items: itemsRaw.map(name => ({ name })) };
  }
  return null;
}
