require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function main() {
  const { data, error } = await supabase.from('prospects').select('source, prospect_data(contract_details)');
  if (error) {
    console.error(error);
    return;
  }
  const sources = new Set(data.map(d => d.source));
  console.log('Sources in DB:', Array.from(sources));
  const types = new Set(data.map(d => {
      const pd = Array.isArray(d.prospect_data) ? d.prospect_data[0] : d.prospect_data;
      return pd?.contract_details?.prospect_type;
  }));
  console.log('Types in DB:', Array.from(types));
}
main();
