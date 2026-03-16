import { Tables } from "@/integrations/supabase/types";

export type Prospect = Tables<"prospects"> & Partial<Tables<"prospect_data">>;
