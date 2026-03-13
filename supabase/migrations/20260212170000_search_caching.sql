-- Create cached_searches table
CREATE TABLE IF NOT EXISTS cached_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_hash TEXT NOT NULL UNIQUE, -- MD5 or simple string of combined parameters
    keyword TEXT,
    city TEXT,
    country TEXT,
    industry TEXT,
    type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cached_results table
CREATE TABLE IF NOT EXISTS cached_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    search_id UUID REFERENCES cached_searches(id) ON DELETE CASCADE,
    data JSONB NOT NULL, -- The full JSON object returned by n8n/Apify
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_cached_searches_query_hash ON cached_searches(query_hash);
CREATE INDEX IF NOT EXISTS idx_cached_results_search_id ON cached_results(search_id);

-- Enable RLS
ALTER TABLE cached_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_results ENABLE ROW LEVEL SECURITY;

-- Policies (allow read/write for authenticated users for now, can be refined)
CREATE POLICY "Allow all for authenticated users on cached_searches"
ON cached_searches FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users on cached_results"
ON cached_results FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
