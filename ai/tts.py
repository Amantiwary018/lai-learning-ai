"""TTS adapter: OpenAI TTS, or the optional private local adapter (ai/local_provider.py)."""
import os

async def synthesize(text: str, voice: str = "kore") -> bytes:
    default = "local" if os.path.exists(os.path.join(os.path.dirname(__file__), "local_provider.py")) else "openai"
    provider = os.environ.get("LAI_TTS_PROVIDER") or default
    if provider == "openai":
        from openai import AsyncOpenAI
        r = await AsyncOpenAI().audio.speech.create(model="gpt-4o-mini-tts", voice=os.environ.get("OPENAI_VOICE", "alloy"), input=text, response_format="mp3")
        return r.content
    import local_provider
    return await local_provider.speak(text, voice)
