export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            activity_log: {
                Row: {
                    id: string
                    user_id: string
                    action_type: string
                    entity_type: string | null
                    entity_id: string | null
                    metadata: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    action_type: string
                    entity_type?: string | null
                    entity_id?: string | null
                    metadata?: Json | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    action_type?: string
                    entity_type?: string | null
                    entity_id?: string | null
                    metadata?: Json | null
                    created_at?: string
                }
            },
            campaigns: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    description: string | null
                    channel: string
                    template_subject: string | null
                    template_body: string | null
                    status: string | null
                    schedule_type: string | null
                    start_date: string | null
                    end_date: string | null
                    contact_limit: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    description?: string | null
                    channel: string
                    template_subject?: string | null
                    template_body?: string | null
                    status?: string | null
                    schedule_type?: string | null
                    start_date?: string | null
                    end_date?: string | null
                    contact_limit?: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    description?: string | null
                    channel?: string
                    template_subject?: string | null
                    template_body?: string | null
                    status?: string | null
                    schedule_type?: string | null
                    start_date?: string | null
                    end_date?: string | null
                    contact_limit?: number
                    created_at?: string
                }
            },
            campaign_prospects: {
                Row: {
                    id: string
                    campaign_id: string | null
                    prospect_id: string | null
                    status: string
                    sent_at: string | null
                }
                Insert: {
                    id?: string
                    campaign_id?: string | null
                    prospect_id?: string | null
                    status?: string
                    sent_at?: string | null
                }
                Update: {
                    id?: string
                    campaign_id?: string | null
                    prospect_id?: string | null
                    status?: string
                    sent_at?: string | null
                }
            },
            email_events: {
                Row: {
                    id: string
                    user_id: string
                    event_type: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    event_type: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    event_type?: string
                    created_at?: string
                }
            },
            ai_chat_messages: {
                Row: {
                    id: string
                    user_id: string
                    role: string
                    content: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    role: string
                    content: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    role?: string
                    content?: string
                    created_at?: string
                }
            },
            profiles: {
                Row: {
                    id: string
                    user_id: string | null
                    full_name: string | null
                    avatar_url: string | null
                    initials: string | null
                    onboarding_completed: boolean
                    company_name: string | null
                    company_type: string | null
                    industry: string | null
                    company_size: string | null
                    target_audience: string | null
                    target_city: string | null
                    target_channel: string | null
                    value_prop: string | null
                    communication_tone: string | null
                    objectives: string | null
                    expectations: string | null
                    user_service_description: string | null
                    role: string
                    created_at: string
                    updated_at: string
                    email: string | null
                    plan_type: string
                    search_limit: number
                    search_usage: number
                    prospect_limit: number
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    full_name?: string | null
                    avatar_url?: string | null
                    initials?: string | null
                    onboarding_completed?: boolean
                    company_name?: string | null
                    company_type?: string | null
                    industry?: string | null
                    company_size?: string | null
                    target_audience?: string | null
                    target_city?: string | null
                    target_channel?: string | null
                    value_prop?: string | null
                    communication_tone?: string | null
                    objectives?: string | null
                    expectations?: string | null
                    user_service_description?: string | null
                    role?: string
                    created_at?: string
                    updated_at?: string
                    email?: string | null
                    plan_type?: string
                    search_limit?: number
                    search_usage?: number
                    prospect_limit?: number
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    full_name?: string | null
                    avatar_url?: string | null
                    initials?: string | null
                    onboarding_completed?: boolean
                    company_name?: string | null
                    company_type?: string | null
                    industry?: string | null
                    company_size?: string | null
                    target_audience?: string | null
                    target_city?: string | null
                    target_channel?: string | null
                    value_prop?: string | null
                    communication_tone?: string | null
                    objectives?: string | null
                    expectations?: string | null
                    user_service_description?: string | null
                    role?: string
                    created_at?: string
                    updated_at?: string
                    email?: string | null
                    plan_type?: string
                    search_limit?: number
                    search_usage?: number
                    prospect_limit?: number
                }
            },
            prospects: {
                Row: {
                    id: string
                    user_id: string
                    source: string
                    status: string
                    score: number
                    tags: string[] | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    source: string
                    status?: string
                    score?: number
                    tags?: string[] | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    source?: string
                    status?: string
                    score?: number
                    tags?: string[] | null
                    created_at?: string
                    updated_at?: string
                }
            },
            prospect_data: {
                Row: {
                    id: string
                    prospect_id: string
                    name: string
                    initials: string | null
                    position: string | null
                    company: string | null
                    email: string | null
                    phone: string | null
                    whatsapp_status: string | null
                    website: string | null
                    address: string | null
                    industry: string | null
                    social_links: Json | null
                    summary: string | null
                    contract_details: Json | null
                    web_intelligence: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    prospect_id: string
                    name: string
                    initials?: string | null
                    position?: string | null
                    company?: string | null
                    email?: string | null
                    phone?: string | null
                    whatsapp_status?: string | null
                    website?: string | null
                    address?: string | null
                    industry?: string | null
                    social_links?: Json | null
                    summary?: string | null
                    contract_details?: Json | null
                    web_intelligence?: Json | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    prospect_id?: string
                    name?: string
                    initials?: string | null
                    position?: string | null
                    company?: string | null
                    email?: string | null
                    phone?: string | null
                    whatsapp_status?: string | null
                    website?: string | null
                    address?: string | null
                    industry?: string | null
                    social_links?: Json | null
                    summary?: string | null
                    contract_details?: Json | null
                    web_intelligence?: Json | null
                    created_at?: string
                }
            },
            campaign_recipients: {
                Row: {
                    id: string
                    campaign_id: string | null
                    user_id: string | null
                    prospect_id: string | null
                    email: string
                    first_name: string | null
                    last_name: string | null
                    company: string | null
                    city: string | null
                    status: string
                    sent_at: string | null
                    opened_at: string | null
                    clicked_at: string | null
                    bounce_reason: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    campaign_id?: string | null
                    user_id?: string | null
                    prospect_id?: string | null
                    email: string
                    first_name?: string | null
                    last_name?: string | null
                    company?: string | null
                    city?: string | null
                    status?: string
                    sent_at?: string | null
                    opened_at?: string | null
                    clicked_at?: string | null
                    bounce_reason?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    campaign_id?: string | null
                    user_id?: string | null
                    prospect_id?: string | null
                    email?: string
                    first_name?: string | null
                    last_name?: string | null
                    company?: string | null
                    city?: string | null
                    status?: string
                    sent_at?: string | null
                    opened_at?: string | null
                    clicked_at?: string | null
                    bounce_reason?: string | null
                    created_at?: string
                }
            },
            email_campaigns: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    status: string | null
                    from_name: string
                    from_email: string
                    reply_to: string | null
                    subject: string
                    body_html: string | null
                    body_text: string | null
                    tags: string[] | null
                    daily_limit: number | null
                    throttle_min_seconds: number | null
                    throttle_max_seconds: number | null
                    schedule_time: string | null
                    enable_warmup: boolean | null
                    warmup_current_day: number | null
                    total_recipients: number | null
                    sent_count: number | null
                    sent_today: number | null
                    opened_count: number | null
                    clicked_count: number | null
                    bounced_count: number | null
                    unsubscribed_count: number | null
                    last_sent_at: string | null
                    daily_reset_at: string | null
                    start_date: string | null
                    end_date: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    status?: string | null
                    from_name: string
                    from_email: string
                    reply_to?: string | null
                    subject: string
                    body_html?: string | null
                    body_text?: string | null
                    tags?: string[] | null
                    daily_limit?: number | null
                    throttle_min_seconds?: number | null
                    throttle_max_seconds?: number | null
                    schedule_time?: string | null
                    enable_warmup?: boolean | null
                    warmup_current_day?: number | null
                    total_recipients?: number | null
                    sent_count?: number | null
                    sent_today?: number | null
                    opened_count?: number | null
                    clicked_count?: number | null
                    bounced_count?: number | null
                    unsubscribed_count?: number | null
                    last_sent_at?: string | null
                    daily_reset_at?: string | null
                    start_date?: string | null
                    end_date?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    status?: string | null
                    from_name?: string
                    from_email?: string
                    reply_to?: string | null
                    subject?: string
                    body_html?: string | null
                    body_text?: string | null
                    tags?: string[] | null
                    daily_limit?: number | null
                    throttle_min_seconds?: number | null
                    throttle_max_seconds?: number | null
                    schedule_time?: string | null
                    enable_warmup?: boolean | null
                    warmup_current_day?: number | null
                    total_recipients?: number | null
                    sent_count?: number | null
                    sent_today?: number | null
                    opened_count?: number | null
                    clicked_count?: number | null
                    bounced_count?: number | null
                    unsubscribed_count?: number | null
                    last_sent_at?: string | null
                    daily_reset_at?: string | null
                    start_date?: string | null
                    end_date?: string | null
                    created_at?: string
                    updated_at?: string
                }
            },
            email_library: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    subject: string
                    body_html: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    subject: string
                    body_html: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    subject?: string
                    body_html?: string
                    created_at?: string
                    updated_at?: string
                }
            },
            user_api_keys: {
                Row: {
                    id: string
                    user_id: string
                    provider: string
                    api_key: string
                    api_secret: string | null
                    label: string | null
                    is_active: boolean
                    last_tested_at: string | null
                    last_test_status: string | null
                    last_test_message: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    provider: string
                    api_key: string
                    api_secret?: string | null
                    label?: string | null
                    is_active?: boolean
                    last_tested_at?: string | null
                    last_test_status?: string | null
                    last_test_message?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    provider?: string
                    api_key?: string
                    api_secret?: string | null
                    label?: string | null
                    is_active?: boolean
                    last_tested_at?: string | null
                    last_test_status?: string | null
                    last_test_message?: string | null
                    created_at?: string
                    updated_at?: string
                }
            },
            smtp_settings: {
                Row: {
                    id: string
                    user_id: string
                    host: string
                    port: number
                    username: string
                    password: string
                    from_email: string
                    imap_host: string | null
                    imap_port: number | null
                    imap_enabled: boolean
                    imap_secure: boolean
                    last_imap_sync: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    host: string
                    port?: number
                    username: string
                    password: string
                    from_email: string
                    imap_host?: string | null
                    imap_port?: number | null
                    imap_enabled?: boolean
                    imap_secure?: boolean
                    last_imap_sync?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    host?: string
                    port?: number
                    username?: string
                    password?: string
                    from_email?: string
                    imap_host?: string | null
                    imap_port?: number | null
                    imap_enabled?: boolean
                    imap_secure?: boolean
                    last_imap_sync?: string | null
                    created_at?: string
                    updated_at?: string
                }
            },
            linkedin_settings: {
                Row: {
                    id: string
                    user_id: string
                    email: string
                    password: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    email: string
                    password: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    email?: string
                    password?: string
                    created_at?: string
                    updated_at?: string
                }
            }
        },
        Views: {
            [_ in never]: never
        }
        Functions: {
            increment_search_usage: {
                Args: { user_id_param: string }
                Returns: void
            }
        }
        Enums: {
            prospect_status: 'new' | 'contacted' | 'interested' | 'signed' | 'rejected'
        }
    }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
