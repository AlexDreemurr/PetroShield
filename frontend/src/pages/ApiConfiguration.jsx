import React, { useState } from "react";
import { CheckCircle2, Cloud, Database, KeyRound, Map, RefreshCw, Save, Server, ShieldCheck, Sparkles } from "lucide-react";
import styled from "styled-components";
import { API_BASE_URL, apiFetch } from "../config/api";
import { BUSINESS_PAGE_LAYOUT, COLORS, FONT_SIZES } from "../constants/STYLES";

const INITIAL_SERVICES = [
  { id: "backend", name: "平台后端服务", provider: "PetroShield API", icon: Server, status: "正常", enabled: true, endpoint: API_BASE_URL, model: "--", timeout: 30, credential: "无需客户端凭证", env: "VITE_API_BASE_URL", description: "平台所有业务数据与操作接口的统一入口。", testable: true },
  { id: "deepseek", name: "AI处置建议", provider: "DeepSeek", icon: Sparkles, status: "服务端管理", enabled: true, endpoint: "https://api.deepseek.com", model: "deepseek-v4-flash", timeout: 25, credential: "••••••••••••••••", env: "DEEPSEEK_API_KEY", description: "确认告警后生成结构化处置建议，失败时自动回退到规则建议。", testable: false },
  { id: "baidu", name: "厂区地图服务", provider: "百度地图 WebGL API", icon: Map, status: import.meta.env.VITE_BAIDU_MAP_AK ? "已配置" : "未配置", enabled: true, endpoint: "https://api.map.baidu.com", model: "卫星地图", timeout: 15, credential: import.meta.env.VITE_BAIDU_MAP_AK ? "••••••••••••••••" : "尚未配置", env: "VITE_BAIDU_MAP_AK", description: "为人员、设备、风险区域及告警中心提供地图底图。", testable: true },
  { id: "database", name: "业务数据库", provider: "Supabase PostgreSQL", icon: Database, status: "服务端管理", enabled: true, endpoint: "Supabase Transaction Pooler", model: "PostgreSQL", timeout: 30, credential: "••••••••••••••••", env: "DATABASE_URL / SUPABASE_DB_URL", description: "保存人员、设备、区域、告警和统计分析业务数据。", testable: false },
  { id: "cdn", name: "静态资源加速", provider: "阿里云 OSS + CDN", icon: Cloud, status: "已部署", enabled: true, endpoint: "https://odayaka.me", model: "HTTPS", timeout: 15, credential: "阿里云控制台管理", env: "部署平台配置", description: "承载生产前端静态资源并通过自定义域名提供访问。", testable: true },
];

function ApiConfiguration() {
  const [services, setServices] = useState(INITIAL_SERVICES);
  const [selectedId, setSelectedId] = useState("backend");
  const [draft, setDraft] = useState(INITIAL_SERVICES[0]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [notice, setNotice] = useState("");
  const selected = services.find((service) => service.id === selectedId) ?? services[0];
  function selectService(service) { setSelectedId(service.id); setDraft(service); setTestResult(null); }
  function update(key) { return (event) => setDraft((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value })); }
  function save() { setServices((current) => current.map((service) => service.id === draft.id ? { ...service, ...draft } : service)); setNotice("配置参数已保存到当前管理会话"); window.setTimeout(() => setNotice(""), 2200); }
  async function testConnection() {
    setTesting(true); setTestResult(null);
    try {
      if (selected.id === "backend") { const response = await apiFetch(`${API_BASE_URL}/health`); if (!response.ok) throw new Error(`HTTP ${response.status}`); setTestResult({ success: true, text: "平台后端连接正常" }); }
      else if (selected.id === "baidu") { setTestResult(import.meta.env.VITE_BAIDU_MAP_AK ? { success: true, text: "前端地图访问密钥已加载" } : { success: false, text: "未检测到 VITE_BAIDU_MAP_AK" }); }
      else if (selected.id === "cdn") { const response = await fetch(window.location.origin, { method: "HEAD" }); if (!response.ok) throw new Error(`HTTP ${response.status}`); setTestResult({ success: true, text: "当前静态站点响应正常" }); }
      else { setTestResult({ success: null, text: "该凭证仅存在于服务端，请通过对应业务调用验证" }); }
    } catch (error) { setTestResult({ success: false, text: `连接失败：${error.message}` }); }
    finally { setTesting(false); }
  }
  return <Page><PageHeader><div><PageTitle>API配置</PageTitle><PageSubtitle>查看平台外部服务、连接参数与凭证来源</PageSubtitle></div><SecurityBadge><ShieldCheck size={15} />敏感凭证由部署环境托管</SecurityBadge></PageHeader><Workspace><ServicePanel><PanelHeader><div><strong>服务连接</strong><span>{services.filter((service) => service.enabled).length} 个已启用</span></div></PanelHeader><ServiceList>{services.map((service) => { const ServiceIcon = service.icon; return <ServiceButton key={service.id} type="button" $active={service.id === selectedId} onClick={() => selectService(service)}><IconBox><ServiceIcon size={17} /></IconBox><ServiceText><strong>{service.name}</strong><span>{service.provider}</span></ServiceText><ServiceStatus $tone={service.status}>{service.status}</ServiceStatus></ServiceButton>; })}</ServiceList></ServicePanel><ConfigPanel><ConfigHeader><div><h2>{selected.name}</h2><p>{selected.description}</p></div><Toggle><input type="checkbox" checked={Boolean(draft.enabled)} onChange={update("enabled")} /><i /><span>{draft.enabled ? "已启用" : "已停用"}</span></Toggle></ConfigHeader><ConfigBody><Section><SectionTitle>连接参数</SectionTitle><FormGrid><Field $wide><span>服务地址</span><input value={draft.endpoint} onChange={update("endpoint")} /></Field><Field><span>模型 / 协议</span><input value={draft.model} onChange={update("model")} /></Field><Field><span>超时时间（秒）</span><input type="number" min="1" max="120" value={draft.timeout} onChange={update("timeout")} /></Field></FormGrid></Section><Section><SectionTitle>凭证与环境变量</SectionTitle><CredentialBox><KeyRound size={18} /><div><span>凭证状态</span><strong>{draft.credential}</strong><small>环境变量：{draft.env}</small></div><Protected>服务端保护</Protected></CredentialBox><Hint>页面不会读取、传输或回显真实密钥。请在 Render、阿里云或本地 `.env` 中修改对应环境变量，并重新部署服务。</Hint></Section><Section><SectionTitle>连接检测</SectionTitle><TestRow><div><span>检测范围</span><strong>{selected.testable ? "非敏感连接和客户端配置" : "仅展示配置状态"}</strong></div><TestButton type="button" onClick={testConnection} disabled={testing}><RefreshCw size={15} className={testing ? "spinning" : ""} />{testing ? "检测中" : "检测连接"}</TestButton></TestRow>{testResult ? <TestResult $success={testResult.success}><CheckCircle2 size={15} />{testResult.text}</TestResult> : null}</Section></ConfigBody><ConfigFooter><span>最后检查：{testResult ? "刚刚" : "尚未执行"}</span><PrimaryButton type="button" onClick={save}><Save size={15} />保存参数</PrimaryButton></ConfigFooter></ConfigPanel></Workspace>{notice ? <Toast>{notice}</Toast> : null}</Page>;
}

const Page = styled.div`height:100%;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);gap:10px;padding:${BUSINESS_PAGE_LAYOUT.padding};overflow:hidden;background:hsl(216 26% 97%);color:hsl(218 22% 22%);`;
const PageHeader = styled.header`display:flex;align-items:center;justify-content:space-between;gap:16px;`;
const PageTitle = styled.h1`margin:0;color:${COLORS.gray10};font-size:${FONT_SIZES.peoplePageTitle};line-height:${BUSINESS_PAGE_LAYOUT.titleLineHeight};`;
const PageSubtitle = styled.p`margin-top:4px;color:hsl(218 10% 48%);font-size:11px;`;
const SecurityBadge = styled.span`height:30px;display:inline-flex;align-items:center;gap:6px;padding:0 10px;border:1px solid hsl(157 34% 78%);border-radius:5px;color:hsl(157 58% 30%);background:hsl(157 45% 96%);font-size:11px;`;
const Workspace = styled.div`min-height:0;display:grid;grid-template-columns:310px minmax(0,1fr);gap:10px;`;
const ServicePanel = styled.aside`min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);border:1px solid hsl(218 18% 88%);border-radius:6px;background:white;overflow:hidden;`;
const PanelHeader = styled.header`height:54px;display:flex;align-items:center;padding:0 14px;border-bottom:1px solid hsl(218 18% 90%);strong{display:block;font-size:13px}span{display:block;margin-top:3px;color:hsl(218 10% 50%);font-size:10px}`;
const ServiceList = styled.div`min-height:0;overflow:auto;padding:7px;`;
const ServiceButton = styled.button`width:100%;min-height:66px;display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:9px;margin-bottom:4px;padding:8px;border:0;border-radius:5px;text-align:left;color:${(p) => p.$active ? "hsl(220 84% 45%)" : "hsl(218 18% 28%)"};background:${(p) => p.$active ? "hsl(220 90% 95%)" : "transparent"};cursor:pointer;&:hover{background:hsl(216 34% 96%)}`;
const IconBox = styled.span`width:34px;height:34px;display:grid;place-items:center;border:1px solid hsl(218 18% 88%);border-radius:5px;background:white;`;
const ServiceText = styled.span`min-width:0;strong{display:block;font-size:12px}span{display:block;margin-top:5px;color:hsl(218 10% 50%);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
const ServiceStatus = styled.span`padding:3px 6px;border-radius:4px;color:${(p) => p.$tone === "未配置" ? "hsl(2 70% 48%)" : p.$tone === "服务端管理" ? "hsl(218 12% 44%)" : "hsl(157 64% 34%)"};background:${(p) => p.$tone === "未配置" ? "hsl(2 78% 96%)" : p.$tone === "服务端管理" ? "hsl(218 18% 94%)" : "hsl(157 55% 94%)"};font-size:9px;white-space:nowrap;`;
const ConfigPanel = styled.section`min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;border:1px solid hsl(218 18% 88%);border-radius:6px;background:white;overflow:hidden;`;
const ConfigHeader = styled.header`height:70px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 18px;border-bottom:1px solid hsl(218 18% 90%);h2{margin:0;font-size:15px}p{max-width:700px;margin-top:5px;color:hsl(218 10% 48%);font-size:11px}`;
const Toggle = styled.label`display:flex;align-items:center;gap:7px;font-size:11px;cursor:pointer;input{position:absolute;opacity:0}i{position:relative;width:34px;height:18px;border-radius:9px;background:hsl(218 15% 76%);transition:.15s}i:after{content:"";position:absolute;left:2px;top:2px;width:14px;height:14px;border-radius:50%;background:white;transition:.15s}input:checked+i{background:${COLORS.blue}}input:checked+i:after{transform:translateX(16px)}`;
const ConfigBody = styled.div`min-height:0;overflow:auto;padding:18px;`;
const Section = styled.section`margin-bottom:22px;`;
const SectionTitle = styled.h3`margin:0 0 11px;font-size:13px;`;
const FormGrid = styled.div`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;`;
const Field = styled.label`display:grid;grid-column:${(p) => p.$wide ? "1/-1" : "auto"};gap:6px;color:hsl(218 14% 38%);font-size:10px;input{width:100%;height:34px;border:1px solid hsl(220 13% 84%);border-radius:6px;padding:0 10px;outline:none;color:hsl(218 18% 25%);font-size:12px}input:focus{border-color:hsl(220 88% 58%);box-shadow:0 0 0 2px hsl(220 90% 94%)}`;
const CredentialBox = styled.div`display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:10px;padding:12px;border:1px solid hsl(218 18% 88%);border-radius:6px;background:hsl(216 28% 98%);color:hsl(218 16% 38%);div{min-width:0}span,small{display:block;color:hsl(218 10% 50%);font-size:9px}strong{display:block;margin:4px 0;font-family:var(--font-data);font-size:11px}`;
const Protected = styled.b`padding:4px 7px;border-radius:4px;color:hsl(157 58% 30%);background:hsl(157 45% 94%);font-size:9px;`;
const Hint = styled.p`margin-top:8px;color:hsl(218 10% 50%);font-size:10px;line-height:1.6;`;
const TestRow = styled.div`display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid hsl(218 18% 88%);border-radius:6px;span{display:block;color:hsl(218 10% 50%);font-size:9px}strong{display:block;margin-top:4px;font-size:11px;font-weight:500}`;
const TestButton = styled.button`height:32px;display:inline-flex;align-items:center;gap:6px;padding:0 11px;border:1px solid hsl(220 70% 72%);border-radius:5px;color:hsl(220 78% 45%);background:white;font-size:11px;cursor:pointer;&:disabled{opacity:.65}.spinning{animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`;
const TestResult = styled.div`display:flex;align-items:center;gap:6px;margin-top:8px;padding:9px 11px;border-radius:5px;color:${(p) => p.$success === false ? "hsl(2 70% 48%)" : p.$success === true ? "hsl(157 64% 34%)" : "hsl(218 14% 42%)"};background:${(p) => p.$success === false ? "hsl(2 78% 96%)" : p.$success === true ? "hsl(157 55% 94%)" : "hsl(218 18% 95%)"};font-size:10px;`;
const ConfigFooter = styled.footer`height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-top:1px solid hsl(218 18% 90%);color:hsl(218 10% 50%);font-size:10px;`;
const PrimaryButton = styled.button`height:34px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 14px;border:0;border-radius:6px;color:white;background:${COLORS.blue};font-size:12px;cursor:pointer;&:hover{background:hsl(220 90% 44%)}`;
const Toast = styled.div`position:fixed;right:24px;top:76px;z-index:1100;padding:10px 15px;border-radius:6px;color:white;background:hsl(218 28% 22%);box-shadow:0 8px 24px rgba(15,23,42,.18);font-size:12px;`;

export default ApiConfiguration;
