-- Create campaign_prospects junction table
CREATE TABLE IF NOT EXISTS public.campaign_prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(campaign_id, prospect_id)
);

-- Enable RLS
ALTER TABLE public.campaign_prospects ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can manage own campaign prospects" ON public.campaign_prospects;
CREATE POLICY "Users can manage own campaign prospects" ON public.campaign_prospects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE public.campaigns.id = campaign_id
            AND public.campaigns.user_id = auth.uid()
        )
    );
