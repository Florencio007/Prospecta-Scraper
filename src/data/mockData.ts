// Seed data for development
// This file contains mock data to help with development and testing

export const mockProspects = [
  {
    name: "Jean Solofo",
    initials: "JS",
    position: "CEO & Fondateur",
    company: "TechMada Solutions",
    source: "LinkedIn",
    score: 92,
    email: "jean.solofo@techmada.mg",
    phone: "+261 34 12 345 67",
    website: "https://techmada.mg",
    city: "Antananarivo",
    tags: ["tech", "leadership"],
    webIntelligence: {
      services: ["Cloud Infra", "Cybersecurity", "DevOps"],
      brandValues: ["#Transparency", "#LocalPartnership", "#Innovation"],
      toneAnalysis: "The company website uses formal, authoritative language emphasizing technical expertise and reliability in the Indian Ocean region."
    },
    linkedinPulse: [
      { type: "New Post", date: "2 days ago", content: "Navigating supply chain disruptions in Madagascar requires a mix of digital resilience and local expertise.", interactions: 42 },
      { type: "Commented", date: "1 week ago", content: "Great insights on the new cybersecurity regulations for African banking." }
    ],
    aiScripts: [
      {
        title: "Cold Outreach - Value Prop",
        content: "Bonjour Jean-Michel,\nI recently came across your thoughts on navigating supply chain disruptions via LinkedIn, and it resonated with the challenges many operations directors are facing in the region. Given TechMada's commitment to transparent local partnerships and digital innovation, I thought you might be interested in how we help companies secure their infrastructure for operational continuity."
      }
    ]
  },
  {
    name: "Aina Rakoto",
    initials: "AR",
    position: "Directrice Marketing",
    company: "HotelLuxe Madagascar",
    source: "Facebook",
    score: 78,
    email: "aina.rakoto@hotelluxe.mg",
    phone: "+261 32 87 654 32",
    website: "https://hotelluxe.mg",
    city: "Nosy Be",
    tags: ["marketing", "hospitality"],
    webIntelligence: {
      services: ["Luxury Travel", "Bespoke Tours", "Event Planning"],
      brandValues: ["#Luxury", "#Sustainability", "#Hospitality"],
      toneAnalysis: "The tone is welcoming, evocative, and high-end, focusing on exclusive experiences and Malagasy hospitality."
    },
    linkedinPulse: [
      { type: "New Post", date: "5 days ago", content: "Sustainability is at the heart of our new eco-resort project in Nosy Be.", interactions: 156 }
    ],
    aiScripts: [
      {
        title: "Eco-Resort Collaboration",
        content: "Chère Aina,\nFélicitations pour le lancement de votre projet d'éco-resort à Nosy Be. Votre accent sur le luxe durable est remarquable. Chez Prospecta, nous aidons les établissements de prestige à connecter avec une clientèle internationale partageant ces valeurs."
      }
    ]
  },
  {
    name: "Nirina Rabemananjara",
    initials: "NR",
    position: "CTO",
    company: "DigiServ Innovations",
    source: "LinkedIn",
    score: 88,
    email: "nirina@digiserv.mg",
    phone: "+261 33 45 678 90",
    website: "https://digiserv.mg",
    city: "Antananarivo",
    tags: ["tech", "engineering"],
    webIntelligence: {
      services: ["Software Dev", "Mobile Apps", "Fintech"],
      brandValues: ["#Efficiency", "#Security", "#CustomerFirst"],
      toneAnalysis: "Pragmatic, technical, and forward-looking, with a heavy emphasis on digital transformation results."
    },
    linkedinPulse: [],
    aiScripts: [
      {
        title: "Digital Transformation",
        content: "Bonjour Nirina,\nEn tant que CTO de DigiServ, vous savez que l'efficacité logicielle est la clé de la croissance. J'ai vu vos récents succès en Fintech..."
      }
    ]
  },
  {
    name: "Hery Andriamampoinimerina",
    initials: "HA",
    position: "Directeur Général",
    company: "AgriTech Madagascar",
    source: "Google",
    score: 72,
    email: "hery.andria@agritech.mg",
    phone: "+261 34 56 789 01",
    website: "https://agritech.mg",
    city: "Antsirabe",
    tags: ["agriculture", "startup"],
  },
  {
    name: "Voahirana Tiana",
    initials: "VT",
    position: "Responsable Ventes",
    company: "MadaExport International",
    source: "WhatsApp",
    score: 81,
    email: "voahirana@madaexport.mg",
    phone: "+261 32 11 223 34",
    website: "https://madaexport.mg",
    city: "Toamasina",
    tags: ["export", "sales"],
  }
];

export const mockCampaigns = [
  {
    id: "1",
    name: "Prospection LinkedIn Q1 2026",
    description: "Campagne de prospection ciblée sur LinkedIn pour les startups tech",
    status: "active" as const,
    progress: 65,
    contacts: 342,
    conversions: 47,
    conversionRate: 14,
    startDate: "2026-01-01",
    endDate: "2026-03-31",
  }
];

export const mockMetrics = {
  totalProspects: 1247,
  activeProspects: 892,
  conversions: 156,
  conversionRate: 12.5,
  avgScoreQuality: 81.3,
  topSource: "LinkedIn",
  topSourceCount: 342,
  weeklyGrowth: 23,
  monthlyGrowth: 89,
};

export const mockStats = {
  bySource: [
    { name: "LinkedIn", count: 342, percentage: 27, color: "#0A66C2" },
    { name: "Google", count: 289, percentage: 23, color: "#4285F4" },
    { name: "Facebook", count: 234, percentage: 19, color: "#1877F2" },
    { name: "WhatsApp", count: 198, percentage: 16, color: "#25D366" },
  ],
  byStatus: [
    { name: "À contacter", count: 456, color: "#FFB84D" },
    { name: "En cours", count: 234, color: "#4A90E2" },
    { name: "Converti", count: 156, color: "#7ED321" },
    { name: "Rejeté", count: 89, color: "#D0021B" },
  ],
};

export const mockActivities = [
  {
    id: "1",
    type: "prospect_added",
    description: "Nouveau prospect ajouté",
    prospect: "Jean Solofo",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  }
];

export const mockReports = [
  {
    id: "1",
    name: "Rapport de Conversion",
    description: "Analyse détaillée des conversions par canal",
    format: "pdf",
    size: "2.4 MB",
    generated: "2026-02-10",
  }
];

// Types pour les données
export interface Prospect {
  id?: string;
  name: string;
  initials: string;
  summary?: string;
  position: string;
  company: string;
  source: string;
  score: number;
  email?: string;
  phone?: string;
  website?: string;
  city?: string;
  address?: string | null;
  industry?: string | null;
  tags?: string[];
  photo?: string;
  createdAt?: Date;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    youtube?: string;
    pinterest?: string;
  };
  webIntelligence?: {
    services: string[];
    brandValues: string[];
    toneAnalysis: string;
  };
  aiIntelligence?: {
    contactInfo: {
      phones: string[];
      emails: string[];
      addresses: string[];
    };
    keyPeople: {
      name: string;
      role: string;
      context: string;
    }[];
    activities: {
      services: string[];
      technologies: string[];
      sectors: string[];
    };
    recentNews: {
      type: string;
      description: string;
    }[];
    companyCulture: {
      mission: string;
      values: string[];
    };
    opportunities: {
      signal: string;
      context: string;
    }[];
    executiveSummary: string;
    salesScripts?: {
      title: string;
      content: string;
    }[];
  };
  linkedinPulse?: {
    type: string;
    date: string;
    content: string;
    interactions: number;
  }[];
  aiScripts?: {
    title: string;
    content: string;
  }[];
  contractDetails?: {
    // LinkedIn / Company specific
    industry?: string;
    foundedYear?: string;
    employeeCount?: string;
    companySize?: string;
    companyType?: string;
    plusCode?: string;
    checkIn?: string;
    rating?: number;
    totalScore?: number;
    category?: string;
    reviews?: any[];
    specialties?: string[];
    experiences?: any[];
    education?: any[];
    skills?: any[];
    certifications?: any[];
    recommendations?: any[];
    about?: any;

    // Google Maps specific
    address?: string;
    googleMapsUrl?: string;
    mapsUrl?: string;
    openingHours?: any[];
    priceLevel?: string;
    latitude?: number;
    longitude?: number;
    placeId?: string;
    postalCode?: string;
    starRating?: number;
    price?: string;
    platformLinks?: any[];
    photo?: string;
  };
}
