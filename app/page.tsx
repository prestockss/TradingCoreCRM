import AuthApp from '@/components/AuthApp';
import { createClient } from '@/lib/supabase';

export default async function Page() {
  const supabase = createClient();

  const { data } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  return <AuthApp initial={(data ?? []) as any} />;
}