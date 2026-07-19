# PetroShield Backend

## DeepSeek 告警处置建议

确认告警后，后端会调用 DeepSeek Chat Completions API 生成结构化处置流程。配置放在 `backend/.env`：

```dotenv
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_TIMEOUT_SECONDS=25
```

只有 `DEEPSEEK_API_KEY` 必须由部署环境提供。未配置 Key、请求超时或模型输出校验失败时，确认告警仍会成功，并自动写入规则降级建议。
