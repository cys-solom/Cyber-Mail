const fs = require('fs');

const SUPABASE_URL = 'https://unhmcjhwtvldsnezoghx.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuaG1jamh3dHZsZHNuZXpvZ2h4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA3NTMzNCwiZXhwIjoyMDkzNjUxMzM0fQ.40xpO4gCFsdEqbP44zcCBU-ZUs512j9M7IXz9y9X8OU';

async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/pg`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    // Try the /query endpoint instead
    const res2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ sql_query: sql }),
    });
    const text = await res2.text();
    return { status: res2.status, body: text };
  }

  const text = await res.text();
  return { status: res.status, body: text };
}

async function main() {
  // Read schema
  const schema = fs.readFileSync('supabase/schema.sql', 'utf-8');

  // Split into individual statements
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const firstLine = stmt.split('\n').find(l => l.trim() && !l.trim().startsWith('--'))?.trim() || '';
    console.log(`[${i + 1}/${statements.length}] ${firstLine.slice(0, 80)}...`);

    const result = await runSQL(stmt + ';');
    if (result.status >= 400) {
      console.log(`  ⚠ Status: ${result.status}, Response: ${result.body.slice(0, 200)}`);
    } else {
      console.log(`  ✓ OK`);
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);
