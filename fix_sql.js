const fs = require('fs');
let sql = fs.readFileSync('supabase_missing_tables.sql', 'utf8');

// Replace CREATE POLICY with safe creation inside a DO block
sql = sql.replace(/CREATE POLICY "([^"]+)"\s*(ON [^\s]+)\s*(FOR [^\s]+)\s*(?:WITH CHECK \(([^;]+)\))?(?:USING \(([^;]+)\))?;/g, (match, policyName, onTable, forAction, withCheck, usingClause) => {
    let result = `DO $$\nBEGIN\n    IF NOT EXISTS (\n        SELECT 1\n        FROM pg_policies\n        WHERE policyname = '${policyName}'\n        AND tablename = split_part('${onTable}', '.', 2)\n    ) THEN\n        CREATE POLICY "${policyName}" ${onTable} ${forAction}`;
    
    if (usingClause) result += ` USING (${usingClause})`;
    if (withCheck) result += ` WITH CHECK (${withCheck})`;
    
    result += `;\n    END IF;\nEND\n$$;`;
    return result;
});

fs.writeFileSync('supabase_missing_tables_fixed.sql', sql);
console.log("SQL script fixed and saved to supabase_missing_tables_fixed.sql");
