from pydantic import BaseModel, Field, ConfigDict
from pydantic.functional_validators import BeforeValidator
from typing import Optional, List, Dict
from typing_extensions import Annotated

# Tells Pydantic to convert MongoDB's ObjectId into a normal string automatically
PyObjectId = Annotated[str, BeforeValidator(str)]

class AgentConfig(BaseModel):
    # Make id optional so it doesn't crash if it's missing during creation
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    description: str
    engine: str 
    icon: str = "Bot" # Added a fallback default
    activeTasks: int = 0
    tools: List[str] = Field(default_factory=list)
    instructions: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class AgentCreate(BaseModel):
    name: str
    description: str
    instructions: str
    engine: str
    tools: Dict[str, bool]

class MessageConfig(BaseModel):
    role: str
    content: str
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

# Add this at the bottom of models.py
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    