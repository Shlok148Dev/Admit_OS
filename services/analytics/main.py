"""
Main application entrypoint for the ADMIT OS Analytics Microservice.
"""

import logging
from typing import Dict
from fastapi import FastAPI

from services.analytics.db import init_db
from services.analytics.routes import outcomes, admin

# Configure logger
logger: logging.Logger = logging.getLogger("analytics_service.main")

app = FastAPI(
    title="ADMIT OS Analytics Service",
    description="Analytics microservice for outcomes, public accuracy tracking, and content review.",
    version="1.0.0"
)

# Lifecycle startup event
@app.on_event("startup")
def startup_event() -> None:
    init_db()

# Mount routers
app.include_router(outcomes.router, prefix="/v1")
app.include_router(admin.router, prefix="/v1")

@app.get("/health")
def health_check() -> Dict[str, str]:
    """Health status probe."""
    return {"status": "healthy", "service": "analytics-service"}
