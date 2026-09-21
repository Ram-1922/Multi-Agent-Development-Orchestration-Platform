import os
import bcrypt
import jwt
import httpx
from jwt.exceptions import InvalidTokenError
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from database import db
from pydantic import BaseModel

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secure-jwt-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

# Get these from your GitHub Developer Settings later
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "Ov23lisd6htPsnmJG3Le")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "715c7d2d0b2bf4f578c4506d941487b77994acbft")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class UserCreate(BaseModel):
    name: str
    email: str  # Changed from EmailStr to prevent dependency crashes
    password: str

class OAuthPayload(BaseModel):
    token: str = None
    code: str = None

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None: raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception
    
    user = await db.client.agent_forge.users.find_one({"email": email})
    if user is None: raise credentials_exception
    return user

@router.post("/register")
async def register(user: UserCreate):
    users_collection = db.client.agent_forge.users
    if await users_collection.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), salt).decode('utf-8')

    await users_collection.insert_one({
        "name": user.name, "email": user.email,
        "hashed_password": hashed_password, "auth_provider": "local",
        "created_at": datetime.utcnow().isoformat()
    })
    return {"status": "success", "message": "User registered"}

@router.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await db.client.agent_forge.users.find_one({"email": form_data.username})
    
    if not user or not user.get("hashed_password") or not bcrypt.checkpw(form_data.password.encode('utf-8'), user["hashed_password"].encode('utf-8')):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = jwt.encode({"sub": user["email"], "name": user["name"], "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": access_token, "token_type": "bearer", "name": user["name"]}

@router.post("/oauth/{provider}")
async def oauth_login(provider: str, payload: OAuthPayload):
    email, name = None, None
    
    # GitHub STRICTLY requires a User-Agent header, or it blocks the request
    async with httpx.AsyncClient(headers={"User-Agent": "AgentForge-App"}) as client:
        if provider == "google":
            resp = await client.get("https://www.googleapis.com/oauth2/v3/userinfo", headers={"Authorization": f"Bearer {payload.token}"})
            if resp.status_code != 200: raise HTTPException(status_code=400, detail="Invalid Google token")
            data = resp.json()
            email, name = data.get("email"), data.get("name")
            
        elif provider == "github":
            token_resp = await client.post("https://github.com/login/oauth/access_token", headers={"Accept": "application/json"}, data={"client_id": GITHUB_CLIENT_ID, "client_secret": GITHUB_CLIENT_SECRET, "code": payload.code})
            access_token = token_resp.json().get("access_token")
            if not access_token: raise HTTPException(status_code=400, detail="Invalid GitHub code")
            
            user_resp = await client.get("https://api.github.com/user", headers={"Authorization": f"Bearer {access_token}"})
            user_data = user_resp.json()
            name = user_data.get("name") or user_data.get("login")
            email = user_data.get("email")
            
            if not email:
                email_resp = await client.get("https://api.github.com/user/emails", headers={"Authorization": f"Bearer {access_token}"})
                email = next((e["email"] for e in email_resp.json() if isinstance(e, dict) and e.get("primary")), None)
        else:
            raise HTTPException(status_code=400, detail="Unknown provider")

    if not email: raise HTTPException(status_code=400, detail="Provider did not share an email")

    users_collection = db.client.agent_forge.users
    user = await users_collection.find_one({"email": email})
    if not user:
        await users_collection.insert_one({"name": name, "email": email, "auth_provider": provider, "created_at": datetime.utcnow().isoformat()})
        
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = jwt.encode({"sub": email, "name": name, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": access_token, "token_type": "bearer", "name": name}