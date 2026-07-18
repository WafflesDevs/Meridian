from pydantic import BaseModel,EmailStr


class ChatInvoke(BaseModel):
    userinput: str
    thread_id: str | None = None


class LLMRes(BaseModel):
    response: str
    thread_id: str

class Createuser(BaseModel):
    email: EmailStr
    password: str
    # Roles : Explorer,Practitioner,Institution
class ReturnCreate(BaseModel):
    email : EmailStr
    role : str
class CurrentUser(BaseModel):
    user_id: str
    role: str
    email: EmailStr | None = None
class LoginUser(BaseModel):
    email: EmailStr
    password: str
class TokenReturn(BaseModel):
    token: str
    type: str
