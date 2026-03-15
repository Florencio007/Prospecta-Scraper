const fs = require('fs');
let sql = fs.readFileSync('supabase_missing_tables.sql', 'utf8');

// The regex matches CREATE POLICY "name" \s* ON public.table_name
sql = sql.replace(/CREATE POLICY "([^"]+)"\s+ON public\.([a-zA-Z0-9_]+)\s+FOR/g, (match, policyName, tableName) => {
    return `DROP POLICY IF EXISTS "${policyName}" ON public.${tableName};\n${match}`;
});

fs.writeFileSync('supabase_missing_tables.sql', sql);
console.log("Regex replaced policies successfully");
