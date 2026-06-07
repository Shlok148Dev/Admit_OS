import json
from typing import List, Dict, Any, Optional
from neo4j import Session
from services.career.schemas import BranchOverviewResponse, JobRoleDetail, BranchPlacementRates

def get_branch_node(session: Session, code: str) -> Optional[Dict[str, Any]]:
    query = "MATCH (b:Branch {code: $code}) RETURN b"
    result = session.run(query, code=code)
    record = result.single()
    return dict(record["b"]) if record else None

def get_branch_jobs(session: Session, code: str) -> List[Dict[str, Any]]:
    query = """
    MATCH (b:Branch {code: $code})-[r:COMMONLY_LEADS_TO]->(jr:JobRole)
    OPTIONAL MATCH (jr)-[:TYPICAL_SALARY_BAND]->(sb:SalaryBand)
    OPTIONAL MATCH (jr)<-[:HIRES_FOR]-(co:Company)
    OPTIONAL MATCH (jr)-[:REQUIRES_SKILL]->(s:Skill)
    RETURN jr.title as title, jr.domain as domain, r.percentage as percentage,
           sb.min as min_sal, sb.max as max_sal, sb.median as med_sal,
           collect(distinct co.name) as companies, collect(distinct s.name) as skills
    """
    result = session.run(query, code=code)
    jobs = []
    for rec in result:
        min_lpa = rec['min_sal'] // 100000 if rec['min_sal'] else 6
        max_lpa = rec['max_sal'] // 100000 if rec['max_sal'] else 8
        med_lpa = f"₹{min_lpa}-{max_lpa} LPA"
        jobs.append({
            "title": rec["title"],
            "domain": rec["domain"] or "Engineering",
            "transition_rate": rec["percentage"] * 100 if rec["percentage"] else None,
            "median_salary": med_lpa,
            "companies": rec["companies"] or [],
            "skills": rec["skills"] or []
        })
    return jobs

def get_branch_skills(session: Session, code: str) -> List[str]:
    query = "MATCH (b:Branch {code: $code})-[:REQUIRES_CORE_SKILL]->(s:Skill) RETURN s.name as name"
    result = session.run(query, code=code)
    return [rec["name"] for rec in result]

def get_branch_pgs(session: Session, code: str) -> List[str]:
    query = "MATCH (b:Branch {code: $code})-[:FEEDS_INTO_PG]->(pg:PGProgram) RETURN pg.name as name"
    result = session.run(query, code=code)
    return [rec["name"] for rec in result]

def build_branch_overview(session: Session, code: str) -> Optional[BranchOverviewResponse]:
    node = get_branch_node(session, code)
    if not node:
        return None
    
    jobs = [JobRoleDetail(**j) for j in get_branch_jobs(session, code)]
    skills = get_branch_skills(session, code)
    pgs = get_branch_pgs(session, code)
    
    trans_str = node.get("transition_options", "{}")
    try:
        transitions = json.loads(trans_str)
    except Exception:
        transitions = {}
        
    placement = BranchPlacementRates(
        iit_placement_rate=node.get("iit_placement_rate", 0.80),
        iit_median_salary=node.get("iit_median_salary", 900000.0),
        nit_placement_rate=node.get("nit_placement_rate", 0.65),
        nit_median_salary=node.get("nit_median_salary", 600000.0)
    )
    
    return BranchOverviewResponse(
        code=node["code"],
        name=node["name"],
        placement_rates=placement,
        common_jobs=jobs,
        core_skills=skills,
        average_salary_range=node.get("salary_range", "₹8-12 LPA"),
        transition_options=transitions,
        pg_feeds=pgs
    )

def get_career_paths(session: Session, branch_code: str, college_code: Optional[str] = None) -> Optional[Dict[str, Any]]:
    overview = build_branch_overview(session, branch_code)
    if not overview:
        return None
    return {
        "branch_code": branch_code,
        "college_code": college_code,
        "paths": [j.model_dump() for j in overview.common_jobs],
        "pg_programs": overview.pg_feeds
    }
