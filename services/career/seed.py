import json
import logging
from sqlalchemy.orm import Session
from neo4j import Session as Neo4jSession
from services.career.models import Scholarship

logger = logging.getLogger("career_service.seed")

def load_seed_data() -> dict:
    try:
        with open("services/career/seed_data.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        with open("seed_data.json", "r", encoding="utf-8") as f:
            return json.load(f)

def seed_sql_scholarships(db: Session, scholarships: list) -> None:
    if db.query(Scholarship).count() > 0:
        return
    for item in scholarships:
        db.add(Scholarship(
            name=item["name"],
            provider=item["provider"],
            description=item["description"],
            amount=item["amount"],
            eligibility_criteria=item.get("eligibility_criteria"),
            eligible_categories=item.get("eligible_categories"),
            eligible_states=item.get("eligible_states"),
            eligible_genders=item.get("eligible_genders"),
            max_family_income=item.get("max_family_income"),
            min_academic_score=item.get("min_academic_score"),
            source_url=item["source_url"],
            data_confidence=item.get("data_confidence", "HIGH")
        ))
    db.commit()
    logger.info("Seeded scholarships to PostgreSQL.")

def create_branch_node(session: Neo4jSession, branch: dict) -> None:
    session.run(
        """
        MERGE (b:Branch {code: $code})
        SET b.name = $name,
            b.iit_placement_rate = $iit_rate,
            b.iit_median_salary = $iit_salary,
            b.nit_placement_rate = $nit_rate,
            b.nit_median_salary = $nit_salary,
            b.salary_range = $salary_range,
            b.transition_options = $transition_options
        """,
        code=branch["code"],
        name=branch["name"],
        iit_rate=branch["iit_placement_rate"],
        iit_salary=branch["iit_median_salary"],
        nit_rate=branch["nit_placement_rate"],
        nit_salary=branch["nit_median_salary"],
        salary_range=branch["salary_range"],
        transition_options=branch["transition_options"]
    )

def create_job_role_and_rel(session: Neo4jSession, branch_code: str, job: dict) -> None:
    session.run(
        "MERGE (j:JobRole {title: $title}) SET j.domain = $domain",
        title=job["title"],
        domain=job["domain"]
    )
    session.run(
        """
        MATCH (b:Branch {code: $branch_code})
        MATCH (j:JobRole {title: $title})
        MERGE (b)-[r:COMMONLY_LEADS_TO]->(j)
        SET r.percentage = $percentage
        """,
        branch_code=branch_code,
        title=job["title"],
        percentage=job["percentage"]
    )

def create_salary_band_and_rel(session: Neo4jSession, job_title: str, job: dict) -> None:
    session.run(
        """
        MATCH (j:JobRole {title: $title})
        MERGE (s:SalaryBand {min: $min, max: $max, median: $median})
        MERGE (j)-[:TYPICAL_SALARY_BAND]->(s)
        """,
        title=job_title,
        min=job["min_salary"],
        max=job["max_salary"],
        median=job["median_salary"]
    )

def create_companies_and_rels(session: Neo4jSession, job_title: str, companies: list) -> None:
    for comp in companies:
        session.run(
            """
            MATCH (j:JobRole {title: $title})
            MERGE (c:Company {name: $comp})
            MERGE (c)-[:HIRES_FOR]->(j)
            """,
            title=job_title,
            comp=comp
        )

def create_skills_and_rels(session: Neo4jSession, job_title: str, skills: list) -> None:
    for skill in skills:
        session.run(
            """
            MATCH (j:JobRole {title: $title})
            MERGE (sk:Skill {name: $skill})
            MERGE (j)-[:REQUIRES_SKILL {importance: 4}]->(sk)
            """,
            title=job_title,
            skill=skill
        )

def seed_neo4j_branches(session: Neo4jSession, branches: list) -> None:
    session.run("MATCH (n) DETACH DELETE n")
    for br in branches:
        create_branch_node(session, br)
        for skill in br["core_skills"]:
            session.run(
                """
                MATCH (b:Branch {code: $code})
                MERGE (sk:Skill {name: $skill})
                MERGE (b)-[:REQUIRES_CORE_SKILL]->(sk)
                """,
                code=br["code"],
                skill=skill
            )
        for pg in br["pg_feeds"]:
            session.run(
                """
                MATCH (b:Branch {code: $code})
                MERGE (p:PGProgram {name: $pg})
                MERGE (b)-[:FEEDS_INTO_PG]->(p)
                """,
                code=br["code"],
                pg=pg
            )
        for job in br["jobs"]:
            create_job_role_and_rel(session, br["code"], job)
            create_salary_band_and_rel(session, job["title"], job)
            create_companies_and_rels(session, job["title"], job["companies"])
            create_skills_and_rels(session, job["title"], job["skills"])
    logger.info("Seeded Neo4j branch graph database.")

def seed_all(db: Session, neo4j_sess: Neo4jSession) -> None:
    data = load_seed_data()
    seed_sql_scholarships(db, data["scholarships"])
    seed_neo4j_branches(neo4j_sess, data["branches"])
