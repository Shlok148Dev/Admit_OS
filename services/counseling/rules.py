"""
JoSAA Rules database and Q&A engine for official counseling rules.
"""
from typing import Dict, List, Tuple

JOSAA_RULES: List[Dict[str, str]] = [
    {
        "id": "RULE_1",
        "title": "Seat Acceptance Fee (SAF) Payment",
        "rule": "Payment of the Seat Acceptance Fee (SAF) is compulsory to secure the allotted seat in the first round of allotment. Failure to pay within the deadline results in automatic cancellation of the seat.",
        "source": "JoSAA Business Rules 2025, Section 34",
    },
    {
        "id": "RULE_2",
        "title": "Slide Option",
        "rule": "The Slide option accepts the allotted seat but allows upgradation to a better branch ONLY within the SAME institute in subsequent rounds.",
        "source": "JoSAA Business Rules 2025, Section 36.1",
    },
    {
        "id": "RULE_3",
        "title": "Float Option",
        "rule": "The Float option accepts the allotted seat but allows upgradation to a better branch/institute in any subsequent rounds.",
        "source": "JoSAA Business Rules 2025, Section 36.2",
    },
    {
        "id": "RULE_4",
        "title": "Freeze Option",
        "rule": "The Freeze option accepts the allotted seat and opts out of any further rounds, locking the choice as final.",
        "source": "JoSAA Business Rules 2025, Section 36.3",
    },
    {
        "id": "RULE_5",
        "title": "Mandatory Document Verification",
        "rule": "Uploading documents and verifying them online is mandatory during the round of first allotment. If documents are rejected, the seat is cancelled.",
        "source": "JoSAA Business Rules 2025, Section 38",
    },
    {
        "id": "RULE_6",
        "title": "Dual Allotment Rule",
        "rule": "A candidate is allotted only one seat at a time. The previous seat is automatically cancelled and released if a new seat is allotted in subsequent rounds.",
        "source": "JoSAA Business Rules 2025, Section 40",
    },
    {
        "id": "RULE_7",
        "title": "Withdrawal Option",
        "rule": "Candidates can withdraw their accepted seat until the penultimate round (Round 5). No withdrawals are allowed in the final round.",
        "source": "JoSAA Business Rules 2025, Section 42",
    },
    {
        "id": "RULE_8",
        "title": "CSAB Special Rounds Eligibility",
        "rule": "CSAB special rounds are conducted for vacant seats in NITs, IIITs, and GFTIs after all JoSAA rounds. All qualified candidates, including those not allotted seats in JoSAA, are eligible.",
        "source": "CSAB Special Round Information Brochure 2025",
    },
    {
        "id": "RULE_9",
        "title": "Seat Cancellation on Non-Reporting",
        "rule": "Failure to pay SAF or upload mandatory documents within the specified timeline constitutes non-reporting and results in automatic forfeiture of the seat.",
        "source": "JoSAA Business Rules 2025, Section 45",
    },
    {
        "id": "RULE_10",
        "title": "Category Upgradation Business Rules",
        "rule": "If a category student (SC/ST/OBC/EWS) qualifies under the open merit rank in a later round, they are upgraded to a GENERAL seat, and their category seat is freed.",
        "source": "JoSAA Business Rules 2025, Section 28",
    }
]

def search_rules(query: str) -> List[Dict[str, str]]:
    """Search for relevant rules based on keywords in the query."""
    keywords = query.lower().split()
    matched: List[Tuple[float, Dict[str, str]]] = []
    
    for r in JOSAA_RULES:
        score = 0.0
        title_lower = r["title"].lower()
        rule_lower = r["rule"].lower()
        
        for kw in keywords:
            if len(kw) < 3:
                continue
            if kw in title_lower:
                score += 2.0
            if kw in rule_lower:
                score += 1.0
                
        if score > 0.0:
            matched.append((score, r))
            
    matched.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in matched]

def format_chat_response(query: str) -> Tuple[str, str, List[str]]:
    """Generate answer, confidence, and sources for the chat query."""
    matched = search_rules(query)
    if not matched:
        return (
            "I couldn't find a specific official JoSAA rule matching your query. Please refer to the official JoSAA business rules brochure at https://josaa.nic.in.",
            "LOW",
            ["Official JoSAA Portal"]
        )
        
    best_match = matched[0]
    confidence = "HIGH" if len(matched) > 0 and best_match["title"].lower() in query.lower() else "MEDIUM"
    
    # Format answer text
    answer = f"According to JoSAA rules regarding **{best_match['title']}**:\n\n{best_match['rule']}"
    if len(matched) > 1:
        other_rules = ", ".join([f"'{m['title']}'" for m in matched[1:3]])
        answer += f"\n\nRelated rule(s) you might find useful: {other_rules}."
        
    sources = [m["source"] for m in matched[:2]]
    return answer, confidence, sources
