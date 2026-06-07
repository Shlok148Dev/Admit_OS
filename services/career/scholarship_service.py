from typing import List, Optional
from sqlalchemy.orm import Session
from services.career.models import Scholarship

def find_scholarships(
    db: Session,
    category: Optional[str] = None,
    state: Optional[str] = None,
    gender: Optional[str] = None,
    income: Optional[float] = None,
    limit: int = 20,
    offset: int = 0
) -> List[Scholarship]:
    results = db.query(Scholarship).all()
    filtered = []
    
    for s in results:
        if category and s.eligible_categories:
            if category.upper() not in [c.upper() for c in s.eligible_categories]:
                continue
        if state and s.eligible_states:
            if state.upper() not in [st.upper() for st in s.eligible_states]:
                continue
        if gender and s.eligible_genders:
            if gender.upper() not in [g.upper() for g in s.eligible_genders]:
                continue
        if income is not None and s.max_family_income is not None:
            if income > float(s.max_family_income):
                continue
        filtered.append(s)
        
    return filtered[offset:offset+limit]
