import React, { useState } from "react";
import { Copy, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router";
import styled from "styled-components";
import { useAuth } from "../auth/authStore";
import { COLORS } from "../constants/STYLES";

const DEFAULT_ACCOUNT = "zhangsan";
const DEFAULT_PASSWORD = "PetroShield@2026";

function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState(DEFAULT_ACCOUNT);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  if (user) return <Navigate to="/" replace />;

  async function copy(value, field) {
    await navigator.clipboard.writeText(value);
    setCopied(field);
    window.setTimeout(() => setCopied(""), 1500);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await login(username.trim(), password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  return <Page><BrandBand><Brand><ShieldCheck size={34} /><div><strong>石安盾</strong><span>PETROSHIELD</span></div></Brand><PlatformName>石安盾多源融合安全监管平台</PlatformName><SecurityText>统一身份认证 · 角色权限控制 · 操作全程审计</SecurityText></BrandBand><LoginPanel><LoginBox><Heading><h1>登录平台</h1><p>使用系统账号进入安全监管工作台</p></Heading><DemoAccount><DemoTitle><span>默认超级管理员</span><b>演示账号</b></DemoTitle><Credential><span>登录账号</span><code>{DEFAULT_ACCOUNT}</code><CopyButton type="button" title="复制账号" onClick={() => copy(DEFAULT_ACCOUNT, "account")}><Copy size={14} /></CopyButton></Credential><Credential><span>登录密码</span><code>{DEFAULT_PASSWORD}</code><CopyButton type="button" title="复制密码" onClick={() => copy(DEFAULT_PASSWORD, "password")}><Copy size={14} /></CopyButton></Credential>{copied ? <Copied>{copied === "account" ? "账号" : "密码"}已复制</Copied> : null}</DemoAccount><Form onSubmit={submit}><Field><span>登录账号</span><InputBox><UserRound size={16} /><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="请输入登录账号" /></InputBox></Field><Field><span>登录密码</span><InputBox><LockKeyhole size={16} /><input autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入登录密码" /><Visibility type="button" title={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</Visibility></InputBox></Field>{error ? <ErrorText>{error}</ErrorText> : null}<Submit type="submit" disabled={busy || !username.trim() || !password}>{busy ? "正在验证..." : "登录"}</Submit></Form><Footnote>首次部署请配置后端 `AUTH_JWT_SECRET`，并在正式使用前重置默认密码。</Footnote></LoginBox></LoginPanel></Page>;
}

const Page = styled.div`height:100%;display:grid;grid-template-columns:minmax(420px,42%) minmax(520px,58%);background:hsl(216 26% 97%);color:hsl(218 24% 18%);`;
const BrandBand = styled.section`position:relative;display:flex;flex-direction:column;padding:46px 52px;color:white;background:hsl(220 68% 27%);overflow:hidden;&:after{content:"";position:absolute;inset:auto -12% -16% 16%;height:46%;border:1px solid rgba(255,255,255,.16);transform:skewY(-9deg);}`;
const Brand = styled.div`display:flex;align-items:center;gap:10px;svg{color:hsl(203 94% 78%)}strong{display:block;font-size:21px}span{display:block;margin-top:2px;font-size:8px;letter-spacing:1.4px}`;
const PlatformName = styled.h2`position:relative;z-index:1;max-width:480px;margin-top:auto;font-size:28px;line-height:1.45;letter-spacing:0;font-weight:650;`;
const SecurityText = styled.p`position:relative;z-index:1;margin:12px 0 38px;color:hsl(211 55% 82%);font-size:12px;`;
const LoginPanel = styled.main`display:grid;place-items:center;padding:40px;background:white;`;
const LoginBox = styled.section`width:min(430px,100%);`;
const Heading = styled.header`margin-bottom:22px;h1{margin:0;font-size:24px}p{margin-top:7px;color:hsl(218 10% 48%);font-size:12px}`;
const DemoAccount = styled.section`position:relative;margin-bottom:20px;padding:13px 14px;border:1px solid hsl(220 65% 84%);border-radius:6px;background:hsl(220 76% 97%);`;
const DemoTitle = styled.div`display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;color:hsl(220 70% 34%);font-size:11px;font-weight:700;b{padding:2px 6px;border-radius:3px;color:hsl(220 76% 42%);background:white;font-size:9px}`;
const Credential = styled.div`height:30px;display:grid;grid-template-columns:68px minmax(0,1fr) 28px;align-items:center;border-top:1px solid hsl(220 52% 89%);font-size:10px;span{color:hsl(218 10% 48%)}code{font-family:var(--font-data);font-size:11px;color:hsl(218 25% 20%)}`;
const CopyButton = styled.button`width:26px;height:26px;display:grid;place-items:center;border:0;border-radius:4px;color:hsl(220 68% 44%);background:transparent;cursor:pointer;&:hover{background:white}`;
const Copied = styled.span`position:absolute;right:14px;bottom:-18px;color:hsl(157 64% 34%);font-size:9px;`;
const Form = styled.form`display:grid;gap:14px;`;
const Field = styled.label`display:grid;gap:7px;color:hsl(218 16% 32%);font-size:11px;`;
const InputBox = styled.div`height:40px;display:flex;align-items:center;gap:9px;border:1px solid hsl(220 13% 82%);border-radius:6px;padding:0 11px;color:hsl(218 12% 48%);&:focus-within{border-color:hsl(220 88% 58%);box-shadow:0 0 0 3px hsl(220 90% 94%)}input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:hsl(218 22% 20%);font-size:12px}`;
const Visibility = styled.button`width:26px;height:26px;display:grid;place-items:center;border:0;background:transparent;color:hsl(218 10% 48%);cursor:pointer;`;
const ErrorText = styled.p`padding:8px 10px;border-radius:5px;color:hsl(2 70% 46%);background:hsl(2 78% 96%);font-size:10px;`;
const Submit = styled.button`height:40px;border:0;border-radius:6px;color:white;background:${COLORS.blue};font-size:13px;font-weight:600;cursor:pointer;&:hover:not(:disabled){background:hsl(220 90% 44%)}&:disabled{cursor:not-allowed;opacity:.65}`;
const Footnote = styled.p`margin-top:18px;color:hsl(218 10% 54%);font-size:9px;line-height:1.6;`;

export default Login;
