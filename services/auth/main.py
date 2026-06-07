from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from services.auth.db import get_db, Base, engine
from services.auth.config import settings
from services.auth.models import User, RefreshToken
from services.auth.schemas import (
    UserRegister, UserLogin, TokenResponse, RefreshRequest,
    SSOLoginRequest, MessageResponse
)
from services.auth.utils import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, verify_token, hash_token
)
from services.auth.sso import verify_google_token, verify_apple_token

app = FastAPI(title="ADMIT OS Auth Service", version="1.0.0")

@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "healthy", "service": "auth-service"}

# Create tables on startup for simplicity in development
@app.on_event("startup")
def startup_event() -> None:
    Base.metadata.create_all(bind=engine)

def get_or_create_sso_user(db: Session, email: str, name: str | None, provider: str, sso_id: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, name=name, is_verified=True, tier="FREE")
        db.add(user)
    if provider == "google":
        user.google_id = sso_id
    elif provider == "apple":
        user.apple_id = sso_id
    db.commit()
    db.refresh(user)
    return user

def register_refresh_token(db: Session, user_id: int, refresh_token: str) -> None:
    token_h = hash_token(refresh_token)
    db_token = RefreshToken(
        token_hash=token_h,
        user_id=user_id,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(db_token)
    db.commit()

@app.post("/v1/auth/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister, db: Session = Depends(get_db)) -> MessageResponse:
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if user_data.phone and db.query(User).filter(User.phone == user_data.phone).first():
        raise HTTPException(status_code=400, detail="Phone already registered")
    new_user = User(
        email=user_data.email,
        phone=user_data.phone,
        name=user_data.name,
        hashed_password=hash_password(user_data.password),
        tier="FREE"
    )
    db.add(new_user)
    db.commit()
    return MessageResponse(message="User registered successfully. Please verify your email.")

@app.post("/v1/auth/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not user.hashed_password or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if user.deleted_at:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")
    
    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    register_refresh_token(db, user.id, refresh)
    return TokenResponse(access_token=access, refresh_token=refresh)

@app.post("/v1/auth/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    token_h = hash_token(payload.refresh_token)
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == token_h).first()
    if not db_token or db_token.revoked or db_token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    
    db_token.revoked = True
    db.commit()
    
    access = create_access_token(db_token.user_id)
    refresh = create_refresh_token(db_token.user_id)
    register_refresh_token(db, db_token.user_id, refresh)
    return TokenResponse(access_token=access, refresh_token=refresh)

@app.post("/v1/auth/logout", response_model=MessageResponse)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)) -> MessageResponse:
    token_h = hash_token(payload.refresh_token)
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == token_h).first()
    if db_token:
        db_token.revoked = True
        db.commit()
    return MessageResponse(message="Successfully logged out")

@app.get("/v1/auth/verify-email/{token}", response_model=MessageResponse)
def verify_email(token: str, db: Session = Depends(get_db)) -> MessageResponse:
    payload = verify_token(token, settings.JWT_SECRET)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=400, detail="Invalid token")
    
    user = db.query(User).filter(User.id == int(payload.get("sub", 0))).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_verified = True
    db.commit()
    return MessageResponse(message="Email verified successfully")

@app.post("/v1/auth/google-sso", response_model=TokenResponse)
async def google_sso(payload: SSOLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user_info = await verify_google_token(payload.token)
    if not user_info:
        raise HTTPException(status_code=400, detail="Invalid Google token")
    
    user = get_or_create_sso_user(
        db, user_info["email"], user_info.get("name"), "google", user_info["sub"]
    )
    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    register_refresh_token(db, user.id, refresh)
    return TokenResponse(access_token=access, refresh_token=refresh)

@app.post("/v1/auth/apple-sso", response_model=TokenResponse)
async def apple_sso(payload: SSOLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user_info = await verify_apple_token(payload.token)
    if not user_info:
        raise HTTPException(status_code=400, detail="Invalid Apple token")
    
    user = get_or_create_sso_user(
        db, user_info["email"], user_info.get("name"), "apple", user_info["sub"]
    )
    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    register_refresh_token(db, user.id, refresh)
    return TokenResponse(access_token=access, refresh_token=refresh)
