import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function RecipesPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createSupabaseAdminClient();
  const { data: recipes } = await admin
    .from('recipes')
    .select('id, name, ingredients, servings, prep_minutes, instructions')
    .eq('family_id', process.env.FAMILY_ID ?? '')
    .order('name', { ascending: true });

  const list = recipes ?? [];

  return (
    <div className="pg-app">
      <header className="pg-header">
        <div className="pg-family-row">
          <div className="pg-avatar" aria-hidden="true">G</div>
          <span className="pg-family-name">Familia García</span>
        </div>
        <h1 className="pg-title">Recetario</h1>
        {list.length > 0 && (
          <p className="pg-subtitle">{list.length} receta{list.length !== 1 ? 's' : ''}</p>
        )}
      </header>

      <main className="pg-main">
        {list.length === 0 ? (
          <p className="pg-empty">
            <strong>Recetario vacío</strong>
            Dile a JARVIS &ldquo;guarda la receta de…&rdquo; para añadir aquí.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}
              role="list">
            {list.map(recipe => {
              const ingredients = (recipe.ingredients as string[] | null) ?? [];
              return (
                <li key={recipe.id} className="pg-recipe-card">
                  <div className="pg-recipe-header">
                    <div className="pg-recipe-name">{recipe.name}</div>
                    <div className="pg-recipe-meta">
                      {recipe.servings    && <span className="pg-recipe-badge">👤 {recipe.servings} rac.</span>}
                      {recipe.prep_minutes && <span className="pg-recipe-badge">⏱ {recipe.prep_minutes} min</span>}
                    </div>
                  </div>

                  {ingredients.length > 0 && (
                    <div className="pg-recipe-ingredients" role="list" aria-label="Ingredientes">
                      {ingredients.map((ing, i) => (
                        <span key={i} className="pg-recipe-chip" role="listitem">{ing}</span>
                      ))}
                    </div>
                  )}

                  {recipe.instructions && (
                    <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.5, margin: 0 }}>
                      {recipe.instructions}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
