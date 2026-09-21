from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from pydantic.functional_validators import BeforeValidator
from typing import Optional, List, Dict
from typing_extensions import Annotated

# Tells Pydantic to convert MongoDB's ObjectId into a normal string automatically
PyObjectId = Annotated[str, BeforeValidator(str)]
PyObjectId = str


class AgentConfig(BaseModel):
    # Make id optional so it doesn't crash if it's missing during creation
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    description: str
    engine: str
    icon: str = "Bot"  # Added a fallback default
    activeTasks: int = 0
    instructions: Optional[str] = None
    welcome_message: Optional[str] = ""

    # NEW: explicit runtime capability flags (replaces the old lossy `tools`
    # list, which stored *which* skills were checked in the builder but was
    # never actually read anywhere in the chat pipeline). These are what
    # main.py now checks before doing a KB lookup, a web search, or handing
    # the model function-calling tools.
    use_knowledge_base: bool = True
    use_web_search: bool = False
    use_tools: bool = False

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class AgentCreate(BaseModel):
    name: str
    description: str
    instructions: str
    engine: str
    welcome_message: Optional[str] = ""
    use_knowledge_base: bool = True
    use_web_search: bool = False
    use_tools: bool = False


class MessageConfig(BaseModel):
    role: str
    content: str
    # BUG FIXED: this default_factory referenced `datetime` but the module
    # never imported it, so any code path relying on the default (rather than
    # always passing timestamp explicitly, as main.py currently does) would
    # raise NameError at request time.
    timestamp: str = Field(default_factory=lambda: datetime.now().strftime("%I:%M %p"))


class ChatSessionConfig(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    agent_id: str
    title: str = "New Chat"
    messages: List[MessageConfig] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    model: Optional[str] = None

# models.py (append to the end)
class UserCreate(BaseModel):
    name: str
    email: str
    password: Optional[str] = None

class UserInDB(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    email: str
    hashed_password: Optional[str] = None
    auth_provider: str = "local" # 'local', 'google', or 'github'
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class Token(BaseModel):
    access_token: str
    token_type: str