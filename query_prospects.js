import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function main() {
  const { data, error } = await supabase.from('prospects').select('source, prospect_data(contract_details)').limit(50);
  if (error) {
    console.error(error);
    return;
  }
  const sources = new Set(data.map(d => d.source));
  console.log('Sources in DB:', Array.from(sources));
  const types = new Set(data.map(d => d.prospect_data?.[0]?.contract_details?.prospect_type || d.prospect_data?.contract_details?.prospect_type));
  console.log('Types in DB:', Array.from(types));
}
main();
