interface AddShoppingFallback {
  tool:  'add_shopping_items';
  items: { name: string }[];
}

interface QueryShoppingFallback {
  tool: 'query_shopping';
}

interface CheckShoppingFallback {
  tool:      'check_shopping_item';
  item_name: string;
}

type FallbackResult = AddShoppingFallback | QueryShoppingFallback | CheckShoppingFallback | null;

// "añade X, Y y Z" / "agrega X" / "compra X"
const ADD_RE   = /\b(a[ñn]ade?|agrega?|compra)\s+(.+)/i;
// "qué hay en la lista" / "muéstrame la lista" / "lista de la compra"
const QUERY_RE = /\b(qu[eé]\s+hay|mu[eé]strame|ver\s+la\s+lista|lista\s+de\s+la\s+compra)\b/i;
// "tacha X" / "marca X" / "he comprado X"
const CHECK_RE = /\b(tacha?|marca|he\s+comprado)\s+(.+)/i;

export function parseFallback(text: string): FallbackResult {
  const addMatch = ADD_RE.exec(text);
  if (addMatch) {
    const itemsRaw = addMatch[2].split(/,| y /i).map(s => s.trim()).filter(Boolean);
    return { tool: 'add_shopping_items', items: itemsRaw.map(name => ({ name })) };
  }

  if (QUERY_RE.test(text)) {
    return { tool: 'query_shopping' };
  }

  const checkMatch = CHECK_RE.exec(text);
  if (checkMatch) {
    return { tool: 'check_shopping_item', item_name: checkMatch[2].trim() };
  }

  return null;
}
