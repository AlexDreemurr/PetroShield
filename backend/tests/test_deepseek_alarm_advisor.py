import asyncio
import json
import os
import unittest
from unittest.mock import patch

from app.services.deepseek_alarm_advisor import generate_alarm_advice


VALID_ADVICE = {
    "objective": "控制告警影响并确认现场恢复安全状态",
    "immediate_actions": ["隔离告警区域", "通知现场负责人"],
    "handling_steps": [
        {
            "action": "核对关联设备和现场状态",
            "responsible_role": "设备值班人员",
            "time_limit": "10分钟内",
            "verification": "现场复核结果与实时测点一致",
        },
        {
            "action": "排除故障并恢复设备",
            "responsible_role": "检维修人员",
            "time_limit": "30分钟内",
            "verification": "设备连续运行稳定且告警解除",
        },
    ],
    "safety_precautions": ["进入现场前确认个人防护装备齐全"],
    "escalation_conditions": ["风险扩大或无法在规定时间内控制"],
    "required_resources": ["便携式检测仪"],
    "closure_criteria": ["现场风险解除并完成处置记录"],
}


def fake_response(content):
    def request(*_args, **_kwargs):
        return {
            "id": "request-1",
            "model": "deepseek-v4-flash",
            "choices": [
                {
                    "finish_reason": "stop",
                    "message": {"content": content},
                }
            ],
            "usage": {"total_tokens": 320},
        }

    return request


class DeepSeekAlarmAdvisorTests(unittest.TestCase):
    def test_missing_key_uses_rule_fallback(self):
        with patch.dict(os.environ, {}, clear=True):
            result = asyncio.run(generate_alarm_advice({}, "规则建议"))

        self.assertEqual(result.content, "规则建议")
        self.assertEqual(result.generation_status, "fallback")
        self.assertEqual(result.source, "rule-assisted")

    def test_valid_json_is_formatted_and_preserved(self):
        with patch.dict(os.environ, {"DEEPSEEK_API_KEY": "test-key"}, clear=True):
            with patch(
                "app.services.deepseek_alarm_advisor._request_chat_completion",
                side_effect=fake_response(json.dumps(VALID_ADVICE, ensure_ascii=False)),
            ):
                result = asyncio.run(generate_alarm_advice({}, "规则建议"))

        self.assertEqual(result.generation_status, "completed")
        self.assertEqual(result.source, "deepseek")
        self.assertEqual(result.structured_content["objective"], VALID_ADVICE["objective"])
        self.assertIn("处置流程：", result.content)
        self.assertEqual(result.usage["total_tokens"], 320)

    def test_invalid_json_uses_rule_fallback(self):
        with patch.dict(os.environ, {"DEEPSEEK_API_KEY": "test-key"}, clear=True):
            with patch(
                "app.services.deepseek_alarm_advisor._request_chat_completion",
                side_effect=fake_response("not-json"),
            ):
                result = asyncio.run(generate_alarm_advice({}, "规则建议"))

        self.assertEqual(result.generation_status, "fallback")
        self.assertIn("JSONDecodeError", result.error_message)


if __name__ == "__main__":
    unittest.main()
