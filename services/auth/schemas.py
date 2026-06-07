from pydantic import BaseModel, EmailStr, Field

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str | None = None
    phone: str | None = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class SSOLoginRequest(BaseModel):
    token: str

class MessageResponse(BaseModel):
    message: str

class UserProfileResponse(BaseModel):
    id: int
    email: EmailStr
    name: str | None
    phone: str | None
    tier: str
    is_verified: bool
