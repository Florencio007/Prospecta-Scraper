
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase config');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInboxView() {
  console.log('Checking inbox_threads_view...');
  const { data, error } = await supabase
    .from('inbox_threads_view')
    .select('*')
    .limit(5);

  if (error) {
    console.error('Error querying inbox_threads_view:', error);
  } else {
    console.log('Results from inbox_threads_view:', data.length);
    console.log(JSON.stringify(data, null, 2));
  }

  console.log('\nChecking email_messages table count...');
  const { count, error: countErr } = await supabase
    .from('email_messages')
    .select('*', { count: 'exact', head: true });
    
  if (countErr) {
    console.error('Error querying email_messages:', countErr);
  } else {
    console.log('Total email_messages:', count);
  }

  console.log('\nChecking email_campaigns...');
  const { data: campaigns, error: campErr } = await supabase
    .from('email_campaigns')
    .select('id, name, status, sent_count');
  
  if (campErr) {
    console.error('Error querying email_campaigns:', campErr);
  } else {
    console.log('Campaigns:', JSON.stringify(campaigns, null, 2));
  }

  console.log('\nChecking campaign_recipients status summary...');
  const { data: recips, error: recipErr } = await supabase
    .from('campaign_recipients')
    .select('status');
  
  if (recipErr) {
    console.error('Error querying campaign_recipients:', recipErr);
  } else {
    const summary = recips.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
    console.log('Recipients summary:', summary);
  }
}

checkInboxView();
