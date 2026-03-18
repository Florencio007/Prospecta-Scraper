import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function testSignup() {
  const email = `test_${Date.now()}@example.com`;
  console.log(`Attempting to sign up with ${email}...`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'password123',
    options: {
      data: {
        full_name: 'Test User',
      }
    }
  });

  if (error) {
    console.error("Signup error:", error);
  } else {
    console.log("Signup success:", data);
  }
}

testSignup();
