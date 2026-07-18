from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("")
def status():
    return {"Status": "Ok"}

