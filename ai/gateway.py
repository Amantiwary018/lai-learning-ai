"""LAI AI Gateway (internal service, never exposed to the browser).

Provides provider-agnostic endpoints used by the Node backend's LAI AI Router:
  POST /chat          text / vision chat completion for a specific model
  POST /tts           text-to-speech (returns mp3 as base64)
  POST /video/build   run the video pipeline (script -> scenes -> voice -> sync -> assemble -> QC)
  GET  /health

Provider adapters:
  - "local"     : optional private adapter in ai/local_provider.py (not part of the repo)
  - "anthropic" : Anthropic API directly (ANTHROPIC_API_KEY)
  - "openai"    : OpenAI Responses API (OPENAI_API_KEY)
Selected with LAI_PROVIDER env (default: anthropic, or "local" when ai/local_provider.py exists). Keys are read from the server environment only.
"""
import base64, os, time, traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

from video_pipeline import build_video

PROVIDER = os.environ.get("LAI_PROVIDER") or ("local" if os.path.exists(os.path.join(os.path.dirname(__file__), "local_provider.py")) else "anthropic")
app = FastAPI(title="LAI AI Gateway")


class Img(BaseModel):
    media_type: str
    data: str  # base64


class Msg(BaseModel):
    role: str
    content: str
    images: list[Img] = []


class ChatReq(BaseModel):
    model: str
    system: str = ""
    messages: list[Msg]
    max_tokens: int = 1500


async def chat_local(req: ChatReq):
    import local_provider  # optional private adapter (see README)
    return await local_provider.chat(req)


async def chat_anthropic(req: ChatReq):
    from anthropic import AsyncAnthropic
    c = AsyncAnthropic()
    msgs = []
    for m in req.messages:
        content = [{"type": "image", "source": {"type": "base64", "media_type": i.media_type, "data": i.data}} for i in m.images]
        content.append({"type": "text", "text": m.content or " "})
        msgs.append({"role": "assistant" if m.role == "assistant" else "user", "content": content})
    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")
    r = await c.messages.create(model=model, system=req.system, max_tokens=req.max_tokens, messages=msgs)
    return "".join(b.text for b in r.content if b.type == "text"), {"input": r.usage.input_tokens, "output": r.usage.output_tokens}


async def chat_openai(req: ChatReq):
    from openai import AsyncOpenAI
    c = AsyncOpenAI()
    inp = []
    for m in req.messages:
        parts = [{"type": "input_image", "image_url": f"data:{i.media_type};base64,{i.data}"} for i in m.images]
        parts.append({"type": "input_text" if m.role != "assistant" else "output_text", "text": m.content or " "})
        inp.append({"role": m.role if m.role in ("user", "assistant") else "user", "content": parts})
    r = await c.responses.create(model=os.environ.get("OPENAI_MODEL", "gpt-5-mini"), instructions=req.system, input=inp,
                                 max_output_tokens=req.max_tokens)
    return r.output_text, {"input": r.usage.input_tokens, "output": r.usage.output_tokens}


ADAPTERS = {"local": chat_local, "anthropic": chat_anthropic, "openai": chat_openai}


@app.get("/health")
async def health():
    return {"ok": True, "provider": PROVIDER}


@app.post("/chat")
async def chat(req: ChatReq):
    t = time.time()
    try:
        text, usage = await ADAPTERS[PROVIDER](req)
        return {"text": text, "usage": usage, "latency_ms": int((time.time() - t) * 1000), "provider": PROVIDER, "model": req.model}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(502, f"provider error: {e}")


class TTSReq(BaseModel):
    text: str
    voice: str = "kore"


@app.post("/tts")
async def tts(req: TTSReq):
    from tts import synthesize
    try:
        audio = await synthesize(req.text[:4000], req.voice)
        return {"audio": base64.b64encode(audio).decode(), "media_type": "audio/mpeg"}
    except Exception as e:
        raise HTTPException(502, f"tts error: {e}")


class VideoReq(BaseModel):
    videoId: str
    lang: str = "en"
    voice: str = "kore"
    scenes: list[dict]
    onlyScenes: list[int] | None = None


@app.post("/video/build")
async def video_build(req: VideoReq):
    try:
        return await build_video(req.videoId, req.scenes, req.lang, req.voice, req.onlyScenes)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"pipeline error: {e}")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("AI_GATEWAY_PORT", "8001")))
