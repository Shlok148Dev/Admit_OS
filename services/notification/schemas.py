from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class PreferenceUpdate(BaseModel):
    channels: Dict[str, bool] = Field(
        ...,
        description="Dictionary mapping channels (PUSH, EMAIL, SMS, WHATSAPP) to their enabled state."
    )

class PreferenceResponse(BaseModel):
    user_id: int
    channels: Dict[str, bool]
    created_at: datetime

    class Config:
        from_attributes = True

class SubscribeRequest(BaseModel):
    exam_type: Optional[str] = None
    college_code: Optional[str] = None
    device_token: Optional[str] = None
    platform: Optional[str] = None

class SubscribeResponse(BaseModel):
    message: str
    subscription_id: Optional[int] = None


class NotificationFeedItem(BaseModel):
    id: int
    channel: str
    template_id: str
    variables: Optional[Dict[str, Any]] = None
    status: str
    sent_at: Optional[datetime] = None
    created_at: datetime
    exam_relevance: Optional[str] = None
    title: str
    body: str

    class Config:
        from_attributes = True

class UpcomingEventResponse(BaseModel):
    id: int
    event_name: str
    exam_type: str
    round_number: Optional[int] = None
    event_date: datetime
    action_required: bool
    official_url: Optional[str] = None
    countdown_days: int

    class Config:
        from_attributes = True

class MessageResponse(BaseModel):
    message: str
