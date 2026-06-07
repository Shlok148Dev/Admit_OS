import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import guidesData from "@/lib/seo_data/guides.json";

interface PageProps {
  params: {
    slug: string;
  };
}

interface GuideDetail {
  title: string;
  category: string;
  description: string;
  content: string;
  faqs: { question: string; answer: string }[];
}

const GUIDES_DETAILS: Record<string, GuideDetail> = {
  "josaa-choice-filling-guide-2026": {
    title: "JoSAA Choice Filling Strategy Guide 2026",
    category: "Engineering Admissions",
    description: "Step-by-step strategy to optimize your JEE Main and JEE Advanced choices.",
    content: "Building an optimal choice-filling list is the most critical part of JoSAA counseling. You should place your highest preferred choices first, regardless of your rank. If you put a lower preferred branch above a higher preferred one because you think you won't get the higher one, you might miss out on a better seat during upgrades. Ensure you mix 'aspirational' seats at the top, followed by 'probable' seats, and 'safe' seats at the bottom.",
    faqs: [
      {
        question: "How many choices can I fill in JoSAA?",
        answer: "There is no upper limit. Candidates are advised to fill as many eligible choices as possible in decreasing order of preference."
      },
      {
        question: "What is the difference between Float and Slide options?",
        answer: "Float allows you to accept the seat but remain open to a better seat in any institute. Slide locks you into the current institute but keeps you open to higher preferred branches within that same institute."
      }
    ]
  },
  "neet-counseling-checklist-2026": {
    title: "NEET UG Counseling Checklist & Guidelines 2026",
    category: "Medical Admissions",
    description: "Essential documents and timelines for NEET All India and State counseling.",
    content: "NEET UG counseling is conducted by the Medical Counseling Committee (MCC) for 15% All India Quota and respective state bodies for 85% state quota. Successful candidates must keep their admit card, scorecard, class 10/12 certificates, category certificates, identity proofs, and medical fitness certificates ready. Missing deadlines for online reporting or fee payments will lead to immediate forfeiture of seat allocation.",
    faqs: [
      {
        question: "What is the free exit option in NEET counseling?",
        answer: "Free exit is available only in Round 1. If you are allotted a seat in Round 1 but do not join, you do not lose your security deposit and remain eligible for subsequent rounds."
      },
      {
        question: "Who is eligible for NEET MCC Round 2?",
        answer: "Registered candidates who were not allotted a seat in Round 1, or those who joined Round 1 seat and opted for upgrade, are eligible."
      }
    ]
  },
  "mht-cet-choice-filling-tips": {
    title: "MHT-CET Counseling: Avoid These Common Mistakes",
    category: "State CET Admissions",
    description: "Mistakes to avoid when selecting colleges in DTE Maharashtra Centralized Admission Process.",
    content: "In MHT-CET CAP rounds, choice hierarchy is absolute. The CAP rules state that if a candidate is allotted their First Preference, it is treated as an Auto-Freeze. You must accept the seat, pay the seat acceptance fee, and report to the allotted college. You will be automatically excluded from further CAP rounds. Therefore, never put a choice you are not 100% sure about as your first choice.",
    faqs: [
      {
        question: "What is Auto-Freeze in MHT-CET CAP?",
        answer: "Auto-Freeze happens when a candidate is allotted their first preference. The candidate must accept it and cannot participate in subsequent rounds."
      },
      {
        question: "Can I change my choices between CAP Round 1 and CAP Round 2?",
        answer: "Yes, candidates who did not freeze their seats can add, delete, or re-order choices before CAP Round 2 starts."
      }
    ]
  },
  "bitsat-counseling-procedure": {
    title: "BITSAT 2026 Iterations & Counseling Overview",
    category: "Private Institute Admissions",
    description: "Understand BITS iterations, waitlist rules, and fee refund timelines.",
    content: "BITSAT counseling is distinct from JoSAA. BITS Pilani conducts its own counseling across Pilani, Goa, and Hyderabad campuses in rounds known as 'Iterations'. There is a mandatory waitlist fee that must be paid to remain in the system if you are not allotted a seat in initial iterations. Upgrade rules apply automatically in subsequent iterations if seats fall vacant.",
    faqs: [
      {
        question: "Are BITSAT counseling and JoSAA linked?",
        answer: "No, BITSAT counseling is completely independent. You can participate in both systems simultaneously."
      },
      {
        question: "Can I get a fee refund if I withdraw from BITS?",
        answer: "Yes, BITS has a tiered refund policy based on which iteration you withdraw from, complying with UGC guidelines."
      }
    ]
  },
  "kcet-document-verification-guide": {
    title: "KCET Document Verification & Eligibility Clauses",
    category: "State CET Admissions",
    description: "A comprehensive guide on eligibility clauses A through O in KCET.",
    content: "KCET document verification is mandatory before option entry. Candidates must satisfy eligibility clauses (such as studying in Karnataka for 7 years, parents residing in Karnataka, or language claims). The KEA (Karnataka Examinations Authority) releases verification slips and secret keys only after verifying original physical documents. Keep your verification slip safe, as the secret key is required for all choice entry operations.",
    faqs: [
      {
        question: "What is Clause A in KCET?",
        answer: "Clause A requires the candidate to have studied in Karnataka for a minimum period of seven academic years between 1st standard and 12th standard."
      },
      {
        question: "How do I get my KCET Option Entry Secret Key?",
        answer: "The secret key is printed on the Document Verification Slip issued by KEA after successful physical verification."
      }
    ]
  }
};

export async function generateStaticParams() {
  return guidesData;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const guide = GUIDES_DETAILS[params.slug];
  if (!guide) {
    return {
      title: "Admission Guide - ADMIT OS",
      description: "Step-by-step admissions counseling guidelines."
    };
  }

  return {
    title: `${guide.title} | ADMIT OS`,
    description: `${guide.description} Read full step-by-step documentation, checklist, and common FAQs for ${guide.category}.`,
    openGraph: {
      title: `${guide.title} | ADMIT OS`,
      description: guide.description,
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(guide.title)}&subtitle=${encodeURIComponent(guide.category)}&badge=GUIDE`,
          width: 1200,
          height: 630,
          alt: `${guide.title} cover image`
        }
      ]
    }
  };
}

export default function GuidePage({ params }: PageProps) {
  const guide = GUIDES_DETAILS[params.slug];
  if (!guide) {
    notFound();
  }

  // Create FAQPage JSON-LD schema
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": guide.faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Schema Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <nav className="mb-6 text-sm text-slate-500">
        <Link href="/" className="hover:text-blue-600 transition-colors">Home</Link>
        <span className="mx-2">&gt;</span>
        <span className="text-slate-700 font-medium">Guides</span>
        <span className="mx-2">&gt;</span>
        <span className="text-slate-400">{guide.category}</span>
      </nav>

      {/* Guide Article Layout */}
      <article className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 mb-8">
        <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold mb-3 uppercase tracking-wider">
          <span>{guide.category}</span>
          <span>•</span>
          <span>Verified Guidelines</span>
        </div>
        
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-4">
          {guide.title}
        </h1>
        
        <p className="text-slate-500 text-lg mb-8 leading-relaxed italic border-l-4 border-blue-500 pl-4">
          {guide.description}
        </p>
        
        <div className="text-slate-700 leading-relaxed space-y-6 text-base">
          <p>{guide.content}</p>
        </div>
      </article>

      {/* FAQs Section */}
      <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Frequently Asked Questions</h2>
        <div className="space-y-6">
          {guide.faqs.map((faq, index) => (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-800 text-base mb-2 flex items-start gap-2">
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-bold">Q</span>
                <span>{faq.question}</span>
              </h3>
              <p className="text-slate-600 text-sm pl-7 leading-relaxed">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Call-to-Action */}
      <div className="mt-8 text-center p-6 bg-gradient-to-br from-slate-900 to-indigo-900 text-white rounded-2xl shadow-md">
        <h3 className="font-bold text-lg mb-2">Need Personalized Counseling Help?</h3>
        <p className="text-xs text-slate-300 mb-4 max-w-md mx-auto leading-relaxed">
          Interact with our AI Counselor to solve choice filling queries, check ranks, and model complex seat upgrade scenarios.
        </p>
        <Link href="/chat" className="inline-block py-2.5 px-6 bg-emerald-500 text-white font-bold text-sm rounded-lg hover:bg-emerald-600 transition-colors shadow-sm">
          Start AI Chat
        </Link>
      </div>
    </div>
  );
}
