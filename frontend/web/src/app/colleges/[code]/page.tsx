import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import collegesData from "@/lib/seo_data/colleges.json";

// Define a map of college details for rendering statically
const COLLEGE_DETAILS: Record<string, {
  name: string;
  type: string;
  state: string;
  city: string;
  nirfEngineering: number;
  nirfOverall: number;
  naac: string;
  established: number;
  intake: number;
  hostel: boolean;
  website: string;
  admissionUrl: string;
}> = {
  IIT_MADRAS: {
    name: "Indian Institute of Technology Madras",
    type: "IIT",
    state: "Tamil Nadu",
    city: "Chennai",
    nirfEngineering: 1,
    nirfOverall: 1,
    naac: "A++",
    established: 1959,
    intake: 1200,
    hostel: true,
    website: "https://www.iitm.ac.in",
    admissionUrl: "https://josaa.nic.in"
  },
  IIT_BOMBAY: {
    name: "Indian Institute of Technology Bombay",
    type: "IIT",
    state: "Maharashtra",
    city: "Mumbai",
    nirfEngineering: 3,
    nirfOverall: 3,
    naac: "A++",
    established: 1958,
    intake: 1350,
    hostel: true,
    website: "https://www.iitb.ac.in",
    admissionUrl: "https://josaa.nic.in"
  },
  IIT_DELHI: {
    name: "Indian Institute of Technology Delhi",
    type: "IIT",
    state: "Delhi",
    city: "New Delhi",
    nirfEngineering: 2,
    nirfOverall: 2,
    naac: "A++",
    established: 1961,
    intake: 1250,
    hostel: true,
    website: "https://home.iitd.ac.in",
    admissionUrl: "https://josaa.nic.in"
  },
  NIT_TRICHY: {
    name: "National Institute of Technology Tiruchirappalli",
    type: "NIT",
    state: "Tamil Nadu",
    city: "Tiruchirappalli",
    nirfEngineering: 8,
    nirfOverall: 21,
    naac: "A",
    established: 1964,
    intake: 1050,
    hostel: true,
    website: "https://www.nitt.edu",
    admissionUrl: "https://josaa.nic.in"
  },
  NIT_SURATHKAL: {
    name: "National Institute of Technology Karnataka Surathkal",
    type: "NIT",
    state: "Karnataka",
    city: "Surathkal",
    nirfEngineering: 12,
    nirfOverall: 38,
    naac: "A+",
    established: 1960,
    intake: 980,
    hostel: true,
    website: "https://www.nitk.ac.in",
    admissionUrl: "https://josaa.nic.in"
  },
  VNIT_NAGPUR: {
    name: "Visvesvaraya National Institute of Technology Nagpur",
    type: "NIT",
    state: "Maharashtra",
    city: "Nagpur",
    nirfEngineering: 41,
    nirfOverall: 82,
    naac: "A",
    established: 1960,
    intake: 950,
    hostel: true,
    website: "https://www.vnit.ac.in",
    admissionUrl: "https://josaa.nic.in"
  },
  MNNIT_ALLAHABAD: {
    name: "Motilal Nehru National Institute of Technology Allahabad",
    type: "NIT",
    state: "Uttar Pradesh",
    city: "Prayagraj",
    nirfEngineering: 49,
    nirfOverall: 98,
    naac: "A",
    established: 1961,
    intake: 1020,
    hostel: true,
    website: "https://www.mnnit.ac.in",
    admissionUrl: "https://josaa.nic.in"
  },
  IIIT_ALLAHABAD: {
    name: "Indian Institute of Information Technology Allahabad",
    type: "IIIT",
    state: "Uttar Pradesh",
    city: "Prayagraj",
    nirfEngineering: 35,
    nirfOverall: 89,
    naac: "A",
    established: 1999,
    intake: 450,
    hostel: true,
    website: "https://www.iiita.ac.in",
    admissionUrl: "https://josaa.nic.in"
  },
  IIIT_DELHI: {
    name: "Indraprastha Institute of Information Technology Delhi",
    type: "IIIT",
    state: "Delhi",
    city: "New Delhi",
    nirfEngineering: 50,
    nirfOverall: 110,
    naac: "A",
    established: 2008,
    intake: 600,
    hostel: true,
    website: "https://www.iiitd.ac.in",
    admissionUrl: "https://jacdelhi.admissions.nic.in"
  },
  COEP_PUNE: {
    name: "COEP Technological University Pune",
    type: "STATE_GOVT",
    state: "Maharashtra",
    city: "Pune",
    nirfEngineering: 73,
    nirfOverall: 150,
    naac: "A+",
    established: 1854,
    intake: 840,
    hostel: true,
    website: "https://www.coep.org.in",
    admissionUrl: "https://cetcell.mahacet.org"
  }
};

interface PageProps {
  params: {
    code: string;
  };
}

export async function generateStaticParams() {
  return collegesData;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const info = COLLEGE_DETAILS[params.code];
  if (!info) {
    return {
      title: "College Profile - ADMIT OS",
      description: "Detailed college profile and admission information."
    };
  }

  return {
    title: `${info.name} (${params.code}) Admissions & Cutoffs | ADMIT OS`,
    description: `Get real-time predictions, placement datasets, and verified cutoffs for ${info.name}, ${info.city}. Established in ${info.established}. NIRF Engineering Rank #${info.nirfEngineering}.`,
    openGraph: {
      title: `${info.name} Admissions & Cutoffs | ADMIT OS`,
      description: `View verified admission reports, eligibility, and dynamic predictions for ${info.name}.`,
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(info.name)}&subtitle=NIRF%20Rank%20%23${info.nirfEngineering}%20%7C%20${info.city}&badge=${encodeURIComponent(info.type)}`,
          width: 1200,
          height: 630,
          alt: `${info.name} share card`
        }
      ]
    }
  };
}

export default function CollegePage({ params }: PageProps) {
  const info = COLLEGE_DETAILS[params.code];
  if (!info) {
    notFound();
  }

  // Define Dataset JSON-LD Schema
  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": `${info.name} Admission & Cutoff Dataset`,
    "description": `Comprehensive verified admission records, seat intakes, NIRF rankings, and historical round-wise cutoffs for engineering and science admissions at ${info.name}.`,
    "license": "https://creativecommons.org/publicdomain/zero/1.0/",
    "isAccessibleForFree": true,
    "creator": {
      "@type": "Organization",
      "name": "ADMIT OS"
    },
    "distribution": [
      {
        "@type": "DataDownload",
        "encodingFormat": "application/json",
        "contentUrl": `https://admitos.in/api/v1/colleges/${params.code}/data`
      }
    ],
    "temporalCoverage": "2020-01-01/2026-12-31"
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Schema Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }}
      />

      <nav className="mb-6 text-sm text-slate-500">
        <Link href="/" className="hover:text-blue-600 transition-colors">Home</Link>
        <span className="mx-2">&gt;</span>
        <span className="text-slate-700 font-medium">Colleges</span>
        <span className="mx-2">&gt;</span>
        <span className="text-slate-400">{params.code}</span>
      </nav>

      {/* College Header Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white rounded-2xl p-8 shadow-xl relative overflow-hidden mb-8">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-12 translate-y-12">
          <span className="text-9xl font-extrabold tracking-tighter">{info.type}</span>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
            Verified Official Info
          </span>
          <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs px-3 py-1 rounded-full font-semibold">
            {info.type}
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 leading-tight">
          {info.name}
        </h1>
        <p className="text-blue-200 text-lg mb-6 flex items-center gap-2">
          <span>{info.city}, {info.state}</span>
          <span>•</span>
          <span>Est. {info.established}</span>
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4">
          <div className="text-center md:text-left">
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">NIRF Engg</div>
            <div className="text-2xl font-bold">#{info.nirfEngineering}</div>
          </div>
          <div className="text-center md:text-left border-l border-white/10 pl-4">
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">NIRF Overall</div>
            <div className="text-2xl font-bold">#{info.nirfOverall}</div>
          </div>
          <div className="text-center md:text-left border-l border-white/10 pl-4">
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">NAAC Grade</div>
            <div className="text-2xl font-bold text-emerald-400">{info.naac}</div>
          </div>
          <div className="text-center md:text-left border-l border-white/10 pl-4">
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Seats Intake</div>
            <div className="text-2xl font-bold">~{info.intake}</div>
          </div>
        </div>
      </div>

      {/* Detail Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <section className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b">Admissions & Eligibility</h2>
            <p className="text-slate-600 mb-4 leading-relaxed">
              Admission to {info.name} is conducted strictly through standardized competitive exam counseling rounds. For IITs and NITs, JoSAA (Joint Seat Allocation Authority) and CSAB (Central Seat Allocation Board) manage the online choice filling and seat allotment process.
            </p>
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 text-sm text-slate-600">
              <span className="font-semibold text-slate-700 block mb-1">Key Entrance Exam:</span>
              {info.type === "IIT" ? "JEE Advanced (Joint Entrance Examination Advanced) rank score." : "JEE Main (Joint Entrance Examination Main) paper score."}
            </div>
          </section>

          <section className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b">Facilities & Campus Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-blue-50/50 rounded-lg">
                <span className="text-xs text-blue-600 font-semibold uppercase block">Hostel Accommodation</span>
                <span className="text-slate-800 font-medium">{info.hostel ? "Available (Mandatory on-campus)" : "Not Available"}</span>
              </div>
              <div className="p-3 bg-emerald-50/50 rounded-lg">
                <span className="text-xs text-emerald-600 font-semibold uppercase block">Accreditation</span>
                <span className="text-slate-800 font-medium">UGC / AICTE Approved</span>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4">Official Links</h3>
            <div className="space-y-3">
              <a href={info.website} target="_blank" rel="noopener noreferrer" className="block text-center w-full py-2 px-4 border border-blue-600 text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-50 transition-colors">
                Visit Website
              </a>
              <a href={info.admissionUrl} target="_blank" rel="noopener noreferrer" className="block text-center w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors">
                Admission Portal
              </a>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-emerald-800 mb-2">Multi-Model Predictions</h3>
            <p className="text-xs text-emerald-700 mb-4 leading-relaxed">
              Calculate your admission chances at {params.code} using our high-precision XGBoost & LightGBM prediction engine.
            </p>
            <Link href={`/rank-radar?college=${params.code}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:text-emerald-900">
              Calculate Chances →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
