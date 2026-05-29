'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function toggleItem(id: string, checked: boolean) {
  const admin = createSupabaseAdminClient();
  await admin
    .from('shopping_items')
    .update({ checked })
    .eq('id', id);
  revalidatePath('/dashboard/shopping');
}

export async function clearChecked() {
  const admin = createSupabaseAdminClient();
  await admin
    .from('shopping_items')
    .delete()
    .eq('family_id', process.env.FAMILY_ID ?? '')
    .eq('checked', true);
  revalidatePath('/dashboard/shopping');
}
