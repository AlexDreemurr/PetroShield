# PetroShield Backend

## 登录认证

登录令牌使用服务端密钥签名。部署前必须在 `backend/.env` 和 Render 环境变量中配置：

```dotenv
AUTH_JWT_SECRET=replace-with-at-least-32-random-characters
AUTH_TOKEN_EXPIRE_MINUTES=480
```

`AUTH_JWT_SECRET` 建议使用密码生成器产生至少 32 字符的随机值，不要提交真实值。数据库迁移会创建默认演示管理员 `zhangsan`，密码只以 bcrypt 哈希保存。

## DeepSeek 告警处置建议

确认告警后，后端会调用 DeepSeek Chat Completions API 生成结构化处置流程。配置放在 `backend/.env`：

```dotenv
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_TIMEOUT_SECONDS=25
```

只有 `DEEPSEEK_API_KEY` 必须由部署环境提供。未配置 Key、请求超时或模型输出校验失败时，确认告警仍会成功，并自动写入规则降级建议。
