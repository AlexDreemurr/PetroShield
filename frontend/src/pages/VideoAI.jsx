import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Camera, ChevronRight,
  Cpu, FileVideo2, ImagePlus, LoaderCircle, MapPin, RefreshCw,
  ScanLine, ShieldAlert, Sparkles, Upload, X,
} from "lucide-react";
import { useNavigate } from "react-router";
import styled from "styled-components";
import { useAuth } from "../auth/authStore";
import { API_BASE_URL, apiFetch, readApiError } from "../config/api";
import { BUSINESS_PAGE_LAYOUT, COLORS, FONT_SIZES } from "../constants/STYLES";
import { getCachedJson, loadCachedJson, PAGE_DATA_URLS } from "../services/pageDataCache";
import { dictionaryColor, dictionaryLabel, useRuntimeDictionaries } from "../services/runtimeDictionaries";

const RISK = {
  重大: { color: "#991b1b", pale: "#fef2f2" },
  严重: { color: "#dc2626", pale: "#fef2f2" },
  中等: { color: "#d97706", pale: "#fffbeb" },
  一般: { color: "#2563eb", pale: "#eff6ff" },
};
const CATEGORY = { person: "人员", vehicle: "车辆", equipment: "设备", environment: "环境" };
const SPRITE_POSITIONS = ["0% 0%", "100% 0%", "0% 100%", "100% 100%"];

function formatTime(value, withDate = false) {
  if (!value) return "--";
  const date = new Date(value);
  return new Intl.DateTimeFormat("zh-CN", {
    month: withDate ? "2-digit" : undefined,
    day: withDate ? "2-digit" : undefined,
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(date).replaceAll("/", "-");
}

function VideoAI() {
  const cached = getCachedJson(PAGE_DATA_URLS.videoAI);
  const [data, setData] = useState(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");
  const [group, setGroup] = useState("all");
  const [selectedEventId, setSelectedEventId] = useState(cached?.events?.[0]?.id ?? null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const dictionaries = useRuntimeDictionaries();
  const eventName = useCallback((value) => dictionaryLabel(dictionaries, "alarm_type", value, value), [dictionaries]);
  const riskName = useCallback((value) => dictionaryLabel(dictionaries, "risk_level", value, value), [dictionaries]);
  const riskColor = useCallback((value) => dictionaryColor(dictionaries, "risk_level", value, RISK[value]?.color), [dictionaries]);

  const load = useCallback(async (force = false) => {
    setError("");
    if (!data) setLoading(true);
    try {
      const payload = await loadCachedJson(PAGE_DATA_URLS.videoAI, { force });
      setData(payload);
      setSelectedEventId((current) => current || payload.events?.[0]?.id || null);
    } catch (nextError) {
      setError(nextError.message || "视频AI数据加载失败");
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => { load(Boolean(cached)).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => [...new Set((data?.cameras || []).map((item) => item.group_name).filter(Boolean))], [data]);
  const cameras = useMemo(() => (data?.cameras || []).filter((item) => group === "all" || item.group_name === group).slice(0, 4), [data, group]);
  const selectedEvent = useMemo(() => (data?.events || []).find((item) => item.id === selectedEventId) || data?.events?.[0] || null, [data, selectedEventId]);

  async function promote(event) {
    try {
      const response = await apiFetch(`${API_BASE_URL}/video-ai/events/${event.id}/promote`, { method: "POST" });
      if (!response.ok) throw new Error(await readApiError(response, "转入告警中心失败"));
      const payload = await response.json();
      setNotice(payload.created ? "已生成正式告警" : "该事件已关联告警");
      await load(true);
      window.setTimeout(() => navigate(`/alarm-center?alarm_id=${encodeURIComponent(payload.alarm_id)}`), 500);
    } catch (nextError) { setNotice(nextError.message); }
  }

  function handleAnalyzed(payload) {
    setUploadOpen(false);
    setNotice(payload.event_id ? "识别完成，已生成待复核事件" : "识别完成，未发现明确异常");
    load(true).then(() => payload.event_id && setSelectedEventId(payload.event_id)).catch(() => {});
  }

  return <Page>
    <PageHeader>
      <div><PageTitle>视频AI融合</PageTitle><PageSubtitle>视频识别、传感器异常预测与多源结果复核</PageSubtitle></div>
      <HeaderStatus $ok={data?.provider?.configured}><span />{data?.provider?.configured ? `${data.provider.model} 已配置` : "视觉模型未配置"}</HeaderStatus>
    </PageHeader>
    <Toolbar>
      <FieldLabel>摄像头分组</FieldLabel>
      <Select value={group} onChange={(event) => setGroup(event.target.value)}><option value="all">全部分组</option>{groups.map((item) => <option key={item}>{item}</option>)}</Select>
      <Divider />
      <FieldLabel>时间范围</FieldLabel><Select defaultValue="1h"><option value="1h">近1小时</option><option value="6h">近6小时</option><option value="24h">近24小时</option></Select>
      <ToolbarSpacer />
      <SecondaryButton type="button" onClick={() => load(true)}><RefreshCw size={14} />刷新</SecondaryButton>
      {hasPermission("video.analyze") ? <PrimaryButton type="button" onClick={() => setUploadOpen(true)}><Sparkles size={15} />上传识别</PrimaryButton> : null}
    </Toolbar>
    <MainGrid>
      <CameraPanel>
        <PanelHeader><div><Camera size={15} /><strong>实时画面</strong><small>{cameras.filter((item) => item.status === "online").length}/{cameras.length} 路在线</small></div><span>演示画面</span></PanelHeader>
        <CameraGrid>
          {loading ? <StateBox><LoaderCircle className="spin" size={22} />视频信息加载中</StateBox> : null}
          {!loading && error && !data ? <StateBox><AlertTriangle size={22} />{error}</StateBox> : null}
          {!loading && cameras.length === 0 ? <StateBox><Camera size={24} />暂无摄像头通道，请先执行视频AI种子数据</StateBox> : null}
          {cameras.map((cameraItem, index) => {
            const cameraEvent = (data?.events || []).find((item) => item.camera.id === cameraItem.id && item.status !== "ignored");
            const selected = cameraEvent?.id === selectedEvent?.id;
            const spriteIndex = Number(cameraItem.metadata?.sprite_index ?? index) % 4;
            return <CameraTile key={cameraItem.id} type="button" $selected={selected} onClick={() => cameraEvent && setSelectedEventId(cameraEvent.id)}>
              <CameraImage $url={cameraItem.preview_url} $position={SPRITE_POSITIONS[spriteIndex]} />
              <CameraShade />
              <CameraTop><strong>{index + 1}　{cameraItem.name}</strong><Online $online={cameraItem.status === "online"}><i />{cameraItem.status === "online" ? "在线" : "离线"}</Online></CameraTop>
              {cameraEvent ? <Detection $risk={riskColor(cameraEvent.risk_level)}><span>{CATEGORY[cameraEvent.category] || "目标"}｜{eventName(cameraEvent.event_type)}</span></Detection> : null}
              <CameraBottom><span>{formatTime(cameraEvent?.detected_at || new Date().toISOString(), true)}</span><span>{cameraItem.area_name}</span></CameraBottom>
            </CameraTile>;
          })}
        </CameraGrid>
      </CameraPanel>
      <SideColumn>
        <EventPanel>
          <PanelHeader><div><ShieldAlert size={15} /><strong>实时识别事件</strong></div><small>近24小时</small></PanelHeader>
          <EventList>{(data?.events || []).slice(0, 7).map((event) => <EventRow key={event.id} type="button" $active={event.id === selectedEvent?.id} onClick={() => setSelectedEventId(event.id)}>
            <EventIcon $risk={riskColor(event.risk_level)}><ScanLine size={15} /></EventIcon>
            <EventCopy><strong>{eventName(event.event_type)}</strong><span>{event.area.name} · {event.camera.name}</span></EventCopy>
            <EventMeta><time>{formatTime(event.detected_at)}</time><RiskBadge $color={riskColor(event.risk_level)}>{riskName(event.risk_level)}</RiskBadge></EventMeta>
          </EventRow>)}</EventList>
        </EventPanel>
        <PredictionPanel>
          <PanelHeader><div><Activity size={15} /><strong>数据异常预测</strong></div><small>未来15分钟</small></PanelHeader>
          <PredictionList>{(data?.predictions || []).slice(0, 5).map((item) => <PredictionRow key={item.id}>
            <Cpu size={14} /><div><strong>{item.device_name}</strong><span>{item.explanation}</span></div><Score $color={riskColor(item.risk_level)}>{Math.round(item.anomaly_score * 100)}%</Score>
          </PredictionRow>)}</PredictionList>
        </PredictionPanel>
      </SideColumn>
    </MainGrid>
    <FusionPanel>
      <FusionHeader><div><Sparkles size={15} /><strong>多源融合结果</strong></div>{selectedEvent ? <span>{formatTime(selectedEvent.detected_at, true)}</span> : null}</FusionHeader>
      {selectedEvent ? <FusionBody>
        <SourceBlock><SourceIcon><Camera size={18} /></SourceIcon><div><label>视觉识别</label><strong>{eventName(selectedEvent.event_type)}</strong><span>置信度 {(selectedEvent.confidence * 100).toFixed(1)}%</span></div></SourceBlock>
        <FlowArrow><ChevronRight size={18} /></FlowArrow>
        <SourceBlock><SourceIcon $green><MapPin size={18} /></SourceIcon><div><label>位置关联</label><strong>{selectedEvent.area.name}</strong><span>{selectedEvent.camera.name}</span></div></SourceBlock>
        <FlowArrow><ChevronRight size={18} /></FlowArrow>
        <SourceBlock><SourceIcon $amber><Activity size={18} /></SourceIcon><div><label>传感数据</label><strong>{data?.predictions?.[0]?.device_name || "暂无关联设备"}</strong><span>{data?.predictions?.[0]?.explanation || "等待观测数据"}</span></div></SourceBlock>
        <FlowArrow><ChevronRight size={18} /></FlowArrow>
        <FusionResult $color={riskColor(selectedEvent.risk_level)}><div><label>融合结论</label><strong>{selectedEvent.summary}</strong><span>综合置信度 {((selectedEvent.fusion_data?.fusion_confidence ?? selectedEvent.confidence) * 100).toFixed(1)}%</span></div><ResultActions>{selectedEvent.linked_alarm_id ? <SecondaryButton onClick={() => navigate(`/alarm-center?alarm_id=${selectedEvent.linked_alarm_id}`)}>查看告警</SecondaryButton> : hasPermission("video.promote") ? <PrimaryButton onClick={() => promote(selectedEvent)}><ShieldAlert size={14} />转为告警</PrimaryButton> : null}</ResultActions></FusionResult>
      </FusionBody> : <EmptyFusion>选择一条识别事件后查看融合依据</EmptyFusion>}
    </FusionPanel>
    {uploadOpen ? <AnalyzeDialog cameras={data?.cameras || []} configured={Boolean(data?.provider?.configured)} onClose={() => setUploadOpen(false)} onComplete={handleAnalyzed} /> : null}
    {notice ? <Toast onAnimationEnd={() => setNotice("")}>{notice}</Toast> : null}
  </Page>;
}

function AnalyzeDialog({ cameras, configured, onClose, onComplete }) {
  const [file, setFile] = useState(null);
  const [cameraId, setCameraId] = useState(cameras[0]?.id || "");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!file) { setPreview(""); return undefined; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function submit() {
    if (!file) { setError("请先选择图片或视频"); return; }
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.append("file", file); if (cameraId) form.append("camera_id", cameraId);
      const response = await apiFetch(`${API_BASE_URL}/video-ai/analyze`, { method: "POST", body: form });
      if (!response.ok) throw new Error(await readApiError(response, "识别失败"));
      onComplete(await response.json());
    } catch (nextError) { setError(nextError.message); } finally { setBusy(false); }
  }
  return <DialogBackdrop onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
    <Dialog><DialogHeader><div><Sparkles size={17} /><strong>上传媒体进行安全识别</strong></div><IconButton type="button" onClick={onClose} disabled={busy}><X size={18} /></IconButton></DialogHeader>
      <DialogBody>
        {!configured ? <ConfigWarning><AlertTriangle size={15} />后端尚未配置 DASHSCOPE_API_KEY，上传后无法调用模型。</ConfigWarning> : null}
        <UploadArea><input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          {preview ? file?.type.startsWith("video/") ? <video src={preview} controls /> : <img src={preview} alt="待识别媒体预览" /> : <div><ImagePlus size={28} /><strong>选择图片或短视频</strong><span>JPG / PNG / WebP 不超过10MB，MP4 / MOV / WebM 不超过20MB</span></div>}
        </UploadArea>
        <DialogField><span>关联摄像头与区域</span><select value={cameraId} onChange={(event) => setCameraId(event.target.value)}><option value="">不关联摄像头</option>{cameras.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.area_name}</option>)}</select></DialogField>
        <ModelNote><FileVideo2 size={16} /><div><strong>识别结果先进入“疑似事件”</strong><span>模型不会直接创建正式告警，需人工复核后点击“转为告警”。</span></div></ModelNote>
        {error ? <DialogError>{error}</DialogError> : null}
      </DialogBody>
      <DialogFooter><SecondaryButton type="button" onClick={onClose} disabled={busy}>取消</SecondaryButton><PrimaryButton type="button" onClick={submit} disabled={busy || !file}>{busy ? <><LoaderCircle className="spin" size={15} />模型分析中</> : <><Upload size={15} />开始识别</>}</PrimaryButton></DialogFooter>
    </Dialog>
  </DialogBackdrop>;
}

const Page = styled.div`box-sizing:border-box;height:100%;min-height:0;display:grid;grid-template-rows:auto 42px minmax(0,1fr) 150px;gap:10px;padding:${BUSINESS_PAGE_LAYOUT.padding};overflow:hidden;background:hsl(216 26% 97%);color:hsl(218 24% 20%);button,select{font:inherit}.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`;
const PageHeader = styled.header`display:flex;align-items:center;justify-content:space-between;gap:16px;`;
const PageTitle = styled.h1`margin:0;color:${COLORS.gray10};font-size:${FONT_SIZES.peoplePageTitle};line-height:${BUSINESS_PAGE_LAYOUT.titleLineHeight};`;
const PageSubtitle = styled.p`margin:3px 0 0;color:hsl(218 10% 48%);font-size:11px;`;
const HeaderStatus = styled.span`display:flex;align-items:center;gap:6px;color:${p => p.$ok ? "hsl(157 54% 35%)" : "hsl(32 82% 42%)"};font-size:10px;span{width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px ${p => p.$ok ? "hsl(157 55% 92%)" : "hsl(38 90% 92%)"}}`;
const Toolbar = styled.div`display:flex;align-items:center;gap:8px;padding:0 10px;border:1px solid hsl(218 18% 88%);border-radius:6px;background:white;`;
const FieldLabel = styled.span`color:hsl(218 12% 42%);font-size:10px;`;
const Select = styled.select`height:28px;min-width:120px;padding:0 28px 0 9px;border:1px solid hsl(218 18% 84%);border-radius:5px;color:hsl(218 20% 26%);background:white;font-size:11px;outline:none;`;
const Divider = styled.i`width:1px;height:18px;margin:0 4px;background:hsl(218 18% 90%);`;
const ToolbarSpacer = styled.span`flex:1;`;
const PrimaryButton = styled.button`height:30px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 11px;border:0;border-radius:5px;color:white;background:hsl(220 90% 50%);font-size:11px;cursor:pointer;&:hover{background:hsl(220 90% 44%)}&:disabled{opacity:.55;cursor:not-allowed}`;
const SecondaryButton = styled.button`height:30px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 11px;border:1px solid hsl(218 18% 84%);border-radius:5px;color:hsl(218 18% 32%);background:white;font-size:11px;cursor:pointer;&:hover{border-color:hsl(220 72% 70%);color:hsl(220 80% 46%)}&:disabled{opacity:.55}`;
const MainGrid = styled.main`min-height:0;display:grid;grid-template-columns:minmax(0,3fr) minmax(330px,1fr);gap:10px;`;
const CameraPanel = styled.section`min-width:0;min-height:0;display:grid;grid-template-rows:38px minmax(0,1fr);border:1px solid hsl(218 18% 87%);border-radius:6px;background:white;overflow:hidden;`;
const PanelHeader = styled.header`display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 11px;border-bottom:1px solid hsl(218 18% 90%);div{display:flex;align-items:center;gap:7px}strong{font-size:12px}small,>span{color:hsl(218 10% 50%);font-size:9px;font-weight:400}`;
const CameraGrid = styled.div`position:relative;min-height:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:6px;padding:6px;background:hsl(218 20% 94%);`;
const StateBox = styled.div`position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;gap:8px;color:hsl(218 10% 48%);background:white;font-size:11px;`;
const CameraTile = styled.button`position:relative;min-width:0;min-height:0;padding:0;border:${p => p.$selected ? "2px solid hsl(220 92% 54%)" : "1px solid hsl(218 20% 78%)"};border-radius:4px;overflow:hidden;background:#182231;cursor:pointer;box-shadow:${p => p.$selected ? "0 0 0 2px hsl(220 90% 88%)" : "none"};text-align:left;`;
const CameraImage = styled.span`position:absolute;inset:0;background-image:url(${p => p.$url || "/demo/video-ai/camera-sprite.png"});background-repeat:no-repeat;background-size:200% 200%;background-position:${p => p.$position};`;
const CameraShade = styled.span`position:absolute;inset:0;background:linear-gradient(to bottom,rgba(3,10,20,.42),transparent 30%,transparent 65%,rgba(3,10,20,.64));`;
const CameraTop = styled.span`position:absolute;left:9px;right:9px;top:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;color:white;text-shadow:0 1px 2px #000;font-size:10px;strong{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
const Online = styled.span`display:flex;align-items:center;gap:4px;flex:0 0 auto;font-size:9px;i{width:6px;height:6px;border-radius:50%;background:${p => p.$online ? "#22c55e" : "#94a3b8"}}`;
const CameraBottom = styled.span`position:absolute;left:9px;right:9px;bottom:7px;display:flex;align-items:center;justify-content:space-between;gap:8px;color:white;text-shadow:0 1px 2px #000;font-size:9px;span:last-child{max-width:48%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
const Detection = styled.span`position:absolute;left:38%;top:25%;width:25%;height:48%;border:2px solid ${p => p.$risk};filter:drop-shadow(0 1px 1px rgba(0,0,0,.35));span{position:absolute;left:-2px;bottom:100%;max-width:190px;padding:3px 5px;color:white;background:${p => p.$risk};font-size:9px;white-space:nowrap}`;
const SideColumn = styled.aside`min-width:0;min-height:0;display:grid;grid-template-rows:minmax(0,1.2fr) minmax(0,.8fr);gap:10px;`;
const EventPanel = styled.section`min-height:0;display:grid;grid-template-rows:38px minmax(0,1fr);border:1px solid hsl(218 18% 87%);border-radius:6px;background:white;overflow:hidden;`;
const EventList = styled.div`min-height:0;overflow:auto;padding:4px 6px;`;
const EventRow = styled.button`width:100%;display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:7px;padding:6px;border:0;border-bottom:1px solid hsl(218 18% 92%);border-radius:4px;color:hsl(218 20% 24%);background:${p => p.$active ? "hsl(220 90% 96%)" : "transparent"};text-align:left;cursor:pointer;&:hover{background:hsl(216 34% 96%)}`;
const EventIcon = styled.span`width:32px;height:25px;display:grid;place-items:center;border-radius:4px;color:${p => p.$risk};background:${p => `${p.$risk}14`};`;
const EventCopy = styled.span`min-width:0;strong,span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}strong{font-size:10px}span{margin-top:3px;color:hsl(218 10% 48%);font-size:8px}`;
const EventMeta = styled.span`display:grid;justify-items:end;gap:4px;time{color:hsl(218 10% 48%);font-size:8px}`;
const RiskBadge = styled.b`width:fit-content;padding:2px 5px;border-radius:3px;color:${p => p.$color};background:${p => `${p.$color}12`};font-size:8px;`;
const PredictionPanel = styled(EventPanel)``;
const PredictionList = styled.div`min-height:0;overflow:auto;padding:4px 8px;`;
const PredictionRow = styled.div`display:grid;grid-template-columns:20px minmax(0,1fr) auto;align-items:center;gap:5px;padding:6px 2px;border-bottom:1px solid hsl(218 18% 92%);color:hsl(220 80% 52%);div{min-width:0}strong,span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}strong{color:hsl(218 20% 28%);font-size:9px}span{margin-top:3px;color:hsl(218 10% 52%);font-size:8px}`;
const Score = styled.b`color:${p => p.$color};font-size:10px;`;
const FusionPanel = styled.section`min-width:0;min-height:0;display:grid;grid-template-rows:34px minmax(0,1fr);border:1px solid hsl(218 18% 87%);border-radius:6px;background:white;overflow:hidden;`;
const FusionHeader = styled(PanelHeader)`border-bottom:1px solid hsl(218 18% 90%);`;
const FusionBody = styled.div`min-width:0;display:grid;grid-template-columns:minmax(150px,.75fr) 28px minmax(150px,.75fr) 28px minmax(190px,1fr) 28px minmax(280px,1.35fr);align-items:stretch;padding:7px;`;
const SourceBlock = styled.div`min-width:0;display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:8px;padding:5px 8px;border:1px solid hsl(218 18% 89%);border-radius:5px;div{min-width:0}label,strong,span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}label{color:hsl(218 10% 50%);font-size:8px}strong{margin:3px 0;font-size:10px}span{color:hsl(218 10% 48%);font-size:8px}`;
const SourceIcon = styled.span`width:32px;height:32px;display:grid;place-items:center;border-radius:5px;color:${p => p.$green ? "#059669" : p.$amber ? "#d97706" : "#2563eb"};background:${p => p.$green ? "#ecfdf5" : p.$amber ? "#fffbeb" : "#eff6ff"};`;
const FlowArrow = styled.div`display:grid;place-items:center;color:hsl(220 88% 60%);`;
const FusionResult = styled.div`min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:6px 9px;border:1px solid ${p => p.$color};border-radius:5px;background:${p => `${p.$color}0d`};div{min-width:0}label,strong,span{display:block}label{color:${p => p.$color};font-size:8px}strong{margin:3px 0;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}span{color:hsl(218 10% 46%);font-size:8px}`;
const ResultActions = styled.span`display:flex;align-items:center;`;
const EmptyFusion = styled.div`display:grid;place-items:center;color:hsl(218 10% 50%);font-size:10px;`;
const DialogBackdrop = styled.div`position:fixed;inset:0;z-index:1200;display:grid;place-items:center;background:rgba(8,15,28,.56);backdrop-filter:blur(2px);`;
const Dialog = styled.div`width:min(620px,calc(100vw - 40px));display:grid;grid-template-rows:52px auto 58px;border-radius:7px;background:white;box-shadow:0 24px 70px rgba(5,12,24,.3);overflow:hidden;`;
const DialogHeader = styled.header`display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid hsl(218 18% 90%);div{display:flex;align-items:center;gap:8px;color:hsl(220 85% 48%)}strong{color:hsl(218 22% 20%);font-size:14px}`;
const IconButton = styled.button`width:30px;height:30px;display:grid;place-items:center;border:0;border-radius:4px;color:hsl(218 12% 42%);background:transparent;cursor:pointer;&:hover{background:hsl(218 18% 94%)}`;
const DialogBody = styled.div`display:grid;gap:11px;padding:14px 16px;`;
const ConfigWarning = styled.div`display:flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid hsl(38 80% 78%);border-radius:5px;color:hsl(32 76% 36%);background:hsl(45 100% 96%);font-size:10px;`;
const UploadArea = styled.label`position:relative;height:230px;display:grid;place-items:center;border:1px dashed hsl(220 50% 70%);border-radius:6px;background:hsl(216 38% 98%);overflow:hidden;cursor:pointer;input{position:absolute;inset:0;opacity:0;cursor:pointer}img,video{width:100%;height:100%;object-fit:contain;background:#0f172a}div{display:grid;justify-items:center;gap:7px;color:hsl(220 80% 50%)}strong{font-size:12px}span{color:hsl(218 10% 50%);font-size:9px}`;
const DialogField = styled.label`display:grid;grid-template-columns:130px minmax(0,1fr);align-items:center;gap:10px;color:hsl(218 14% 38%);font-size:10px;select{height:34px;padding:0 9px;border:1px solid hsl(218 18% 84%);border-radius:5px;background:white;font-size:11px}`;
const ModelNote = styled.div`display:grid;grid-template-columns:24px minmax(0,1fr);align-items:center;gap:7px;padding:8px 10px;border-radius:5px;color:hsl(220 80% 50%);background:hsl(220 90% 97%);strong,span{display:block}strong{color:hsl(218 20% 24%);font-size:10px}span{margin-top:3px;color:hsl(218 10% 48%);font-size:9px}`;
const DialogError = styled.div`color:hsl(2 72% 48%);font-size:10px;`;
const DialogFooter = styled.footer`display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:0 16px;border-top:1px solid hsl(218 18% 90%);`;
const Toast = styled.div`position:fixed;right:24px;top:76px;z-index:1400;padding:10px 15px;border-radius:5px;color:white;background:hsl(218 28% 22%);box-shadow:0 8px 24px rgba(15,23,42,.18);font-size:11px;animation:toast 2.8s both;@keyframes toast{0%{opacity:0;transform:translateY(-6px)}10%,82%{opacity:1;transform:none}100%{opacity:0}}`;

export default VideoAI;
