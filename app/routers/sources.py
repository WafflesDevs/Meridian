from fastapi import APIRouter,HTTPException,status
from app.core.rag import get_supabase

router = APIRouter(prefix="/source", tags=["Source"])

@router.get("")
def list_sources():
    try:
        result = get_supabase().table("documents").select("metadata").execute()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch sources")
    names = set()
    for row in result.data or []:
        source = (row.get("metadata") or {}).get("source")
        if source:
            names.add(source.split("/")[-1])
    if not names:
        raise HTTPException(status_code=404, detail="No sources found")
    return {"sources": sorted(names)}