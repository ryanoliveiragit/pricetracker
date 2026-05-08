from fastapi import FastAPI

app = FastAPI()


@app.get("/health")
async def health():
    return {"status": "ok", "version": "minimal"}


@app.get("/")
async def root():
    return {"message": "ok"}
