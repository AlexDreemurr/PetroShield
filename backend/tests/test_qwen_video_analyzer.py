import asyncio
import json
import os
import unittest
from unittest.mock import patch

from app.services.qwen_video_analyzer import VideoAnalysisError, analyze_safety_media


def fake_response(*_args, **_kwargs):
    payload = {
        "abnormal": True,
        "event_type": "未佩戴安全帽",
        "category": "person",
        "risk_level": "严重",
        "confidence": 0.93,
        "summary": "画面中的作业人员未佩戴安全帽",
        "objects": [{"label": "person", "confidence": 0.95, "bbox": [0.2, 0.1, 0.6, 0.9]}],
        "evidence_notes": ["头部区域未见安全帽"],
        "suggested_actions": ["由现场安全员复核"],
    }
    return {
        "id": "qwen-request-1",
        "model": "qwen3-vl-flash",
        "choices": [{"message": {"content": json.dumps(payload, ensure_ascii=False)}}],
        "usage": {"total_tokens": 240},
    }


class QwenVideoAnalyzerTests(unittest.TestCase):
    def test_missing_key_fails_without_calling_provider(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(VideoAnalysisError) as context:
                asyncio.run(analyze_safety_media(content=b"image", mime_type="image/jpeg", media_type="image", context={}))
        self.assertIn("DASHSCOPE_API_KEY", str(context.exception))

    def test_image_result_is_validated(self):
        with patch.dict(os.environ, {"DASHSCOPE_API_KEY": "test-key"}, clear=True):
            with patch("app.services.qwen_video_analyzer._request", side_effect=fake_response) as request:
                result = asyncio.run(analyze_safety_media(
                    content=b"image", mime_type="image/jpeg", media_type="image",
                    context={"camera": {"name": "测试摄像头"}},
                ))
        self.assertTrue(result.payload.abnormal)
        self.assertEqual(result.payload.event_type, "未佩戴安全帽")
        self.assertEqual(result.request_id, "qwen-request-1")
        body = request.call_args.args[2]
        media = body["messages"][1]["content"][0]
        self.assertTrue(media["image_url"]["url"].startswith("data:image/jpeg;base64,"))

    def test_invalid_provider_payload_is_rejected(self):
        invalid = {"choices": [{"message": {"content": "{}"}}]}
        with patch.dict(os.environ, {"DASHSCOPE_API_KEY": "test-key"}, clear=True):
            with patch("app.services.qwen_video_analyzer._request", return_value=invalid):
                with self.assertRaises(VideoAnalysisError):
                    asyncio.run(analyze_safety_media(content=b"video", mime_type="video/mp4", media_type="video", context={}))


if __name__ == "__main__":
    unittest.main()
