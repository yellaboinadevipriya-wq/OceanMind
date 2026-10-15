import json
import os
import urllib.error
import urllib.parse
import urllib.request

from fastapi import APIRouter, File, HTTPException, UploadFile

from database import get_connection

router = APIRouter()

MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


@router.get("/database/observations/{observation_id}")
def get_observation(observation_id: int):
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, observation_time, latitude, longitude,
                   sea_surface_temperature, temperature_anomaly,
                   source, is_anomaly
            FROM observations
            WHERE id = ?
            """,
            (observation_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Observation not found.")

    return {"observation": dict(row)}


@router.get("/analysis/status")
def analysis_status():
    configured = bool(os.environ.get("HF_TOKEN", "").strip())
    model = os.environ.get(
        "OCEANMIND_VISION_MODEL",
        "google/vit-base-patch16-224",
    )
    return {
        "configured": configured,
        "provider": "Hugging Face Inference API",
        "model": model,
        "status": "configured" if configured else "setup_required",
        "notice": (
            "General-purpose image classification; not validated for "
            "scientific ocean or satellite hazard detection."
        ),
    }


@router.post("/analysis/image")
async def analyze_image(file: UploadFile = File(...)):
    token = os.environ.get("HF_TOKEN", "").strip()
    if not token:
        raise HTTPException(
            status_code=503,
            detail="Image inference is not configured. Set HF_TOKEN on the backend.",
        )

    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Upload a JPEG, PNG, or WEBP image.",
        )

    image_bytes = await file.read(MAX_IMAGE_BYTES + 1)
    await file.close()

    if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Image must be non-empty and no larger than 10 MB.",
        )

    valid_signature = (
        content_type == "image/jpeg"
        and image_bytes.startswith(b"\xff\xd8\xff")
    ) or (
        content_type == "image/png"
        and image_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    ) or (
        content_type == "image/webp"
        and len(image_bytes) >= 12
        and image_bytes[:4] == b"RIFF"
        and image_bytes[8:12] == b"WEBP"
    )

    if not valid_signature:
        raise HTTPException(
            status_code=400,
            detail="The file content does not match its declared image type.",
        )

    model = os.environ.get(
        "OCEANMIND_VISION_MODEL",
        "google/vit-base-patch16-224",
    ).strip()

    if not model or "/" not in model:
        raise HTTPException(
            status_code=500,
            detail="OCEANMIND_VISION_MODEL must be a valid model identifier.",
        )

    model_path = urllib.parse.quote(model, safe="/")
    url = f"https://router.huggingface.co/hf-inference/models/{model_path}"

    request = urllib.request.Request(
        url,
        data=image_bytes,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": content_type,
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read(2000).decode("utf-8", errors="replace")
        raise HTTPException(
            status_code=502,
            detail=f"Image inference provider returned HTTP {exc.code}: {details}",
        )
    except (urllib.error.URLError, TimeoutError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach the image inference provider: {exc}",
        )
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(
            status_code=502,
            detail="The image provider returned an unreadable response.",
        )

    if not isinstance(result, list) or not result:
        raise HTTPException(
            status_code=502,
            detail="The selected model did not return classification predictions.",
        )

    predictions = []
    for item in result:
        if not isinstance(item, dict):
            continue
        label = item.get("label")
        score = item.get("score")
        if isinstance(label, str) and isinstance(score, (int, float)):
            predictions.append({
                "label": label,
                "score": max(0.0, min(1.0, float(score))),
            })

    if not predictions:
        raise HTTPException(
            status_code=502,
            detail="No valid label/score predictions were returned by the model.",
        )

    predictions.sort(key=lambda item: item["score"], reverse=True)

    return {
        "model": model,
        "provider": "Hugging Face Inference API",
        "predictions": predictions[:5],
        "notice": (
            "Scores are model classification scores, not calibrated "
            "scientific confidence. This general-purpose model is not "
            "validated for ocean temperature, hazards, or marine detection."
        ),
    }
