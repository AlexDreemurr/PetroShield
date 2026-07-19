import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import styled from "styled-components";
import {
  AlertTriangle, Bot, Check, ChevronLeft, ChevronRight,
  FileCheck2, MapPin, Pause, Play, RefreshCw, RotateCcw,
  Search, ShieldCheck, UserRound,
} from "lucide-react";
import RiskEventTraceMap from "../components/RiskEventTraceMap/RiskEventTraceMap";
import { BUSINESS_PAGE_LAYOUT } from "../constants/STYLES";
import { getCachedJson, loadCachedJson, PAGE_DATA_URLS } from "../services/pageDataCache";
import { dictionaryColor, dictionaryLabel, useRuntimeDictionaries } from "../services/runtimeDictionaries";

const PAGE_SIZE = 10;
const LEVEL_ORDER = { 重大: 4, 严重: 3, 中等: 2, 一般: 1 };
const CLOSED_STATUSES = new Set(["关闭", "误报"]);

function DynamicLevelBadge({ level }) {
  const dictionaries = useRuntimeDictionaries();
  return <LevelBadge $level={level} $color={dictionaryColor(dictionaries, "risk_level", level)}>{dictionaryLabel(dictionaries, "risk_level", level, level)}</LevelBadge>;
}

function DynamicAlarmType({ value }) {
  const dictionaries = useRuntimeDictionaries();
  return dictionaryLabel(dictionaries, "alarm_type", value, value);
}

function formatDateTime(value, seconds = true) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    second: seconds ? "2-digit" : undefined, hour12: false,
  }).format(new Date(value)).replaceAll("/", "-");
}

function durationText(event) {
  const start = new Date(event.time).getTime();
  const end = new Date(event.update_time || event.create_time || event.time).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "--";
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  return seconds >= 3600 ? `${Math.floor(seconds / 3600)}时${Math.floor((seconds % 3600) / 60)}分` : `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
}

function getLog(event, actions) {
  return event.logs?.find((log) => actions.includes(log.action));
}

function buildMilestones(event) {
  const confirm = getLog(event, ["confirm"]);
  const dispatch = getLog(event, ["dispatch"]);
  const feedback = getLog(event, ["submit_feedback"]);
  const close = getLog(event, ["review_approve", "close", "mark_false_positive"]);
  return [
    { label: "事件发生", detail: event.type, time: event.time, done: true },
    { label: "自动分级", detail: `${event.level}风险`, time: event.create_time || event.time, done: true },
    { label: "人工确认", detail: confirm?.operator_name || "等待确认", time: confirm?.create_time, done: Boolean(confirm) },
    { label: "派单处理", detail: event.assignment?.assignee_name || dispatch?.operator_name || "等待派单", time: event.assignment?.assigned_at || dispatch?.create_time, done: Boolean(event.assignment || dispatch) },
    { label: "现场反馈", detail: event.assignment?.feedback || "等待反馈", time: event.assignment?.completed_at || feedback?.create_time, done: Boolean(event.assignment?.completed_at || feedback) },
    { label: "关闭归档", detail: CLOSED_STATUSES.has(event.status) ? event.status : "等待闭环", time: close?.create_time || (CLOSED_STATUSES.has(event.status) ? event.update_time : null), done: CLOSED_STATUSES.has(event.status) },
  ];
}

function RiskEventTraceability() {
  const initial = getCachedJson(PAGE_DATA_URLS.riskEvents);
  const initialRef = useRef(initial);
  const [payload, setPayload] = useState(initial);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(initial?.items?.[0]?.id ?? null);
  const [filters, setFilters] = useState({ start: "", end: "", query: "", type: "全部", level: "全部" });
  const [page, setPage] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  async function load(force = false) {
    const cached = getCachedJson(PAGE_DATA_URLS.riskEvents);
    if (!cached) setLoading(true);
    setError("");
    try {
      const next = await loadCachedJson(PAGE_DATA_URLS.riskEvents, { force });
      setPayload(next);
      setSelectedId((current) => current && next.items.some((item) => item.id === current) ? current : next.items[0]?.id ?? null);
    } catch { if (!cached) setError("风险事件数据加载失败"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(Boolean(initialRef.current)); }, []);
  const events = useMemo(() => payload?.items ?? [], [payload]);
  const filtered = useMemo(() => events.filter((event) => {
    const occurred = new Date(event.time);
    const keyword = filters.query.trim().toLowerCase();
    const haystack = [event.id, event.type, event.subject?.name, event.subject?.meta, event.area?.name].filter(Boolean).join(" ").toLowerCase();
    return (filters.type === "全部" || event.type === filters.type)
      && (filters.level === "全部" || event.level === filters.level)
      && (!filters.start || occurred >= new Date(`${filters.start}T00:00:00`))
      && (!filters.end || occurred <= new Date(`${filters.end}T23:59:59`))
      && (!keyword || haystack.includes(keyword));
  }).sort((a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level] || new Date(b.time) - new Date(a.time)), [events, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = events.find((event) => event.id === selectedId) ?? filtered[0] ?? null;
  const track = selected?.track ?? [];
  const milestones = selected ? buildMilestones(selected) : [];

  useEffect(() => { setPage(1); }, [filters]);
  useEffect(() => { setActiveIndex(0); setPlaying(false); }, [selectedId]);
  useEffect(() => {
    if (!playing || track.length < 2) return undefined;
    const timer = window.setInterval(() => setActiveIndex((current) => current >= track.length - 1 ? 0 : current + 1), 420);
    return () => window.clearInterval(timer);
  }, [playing, track.length]);

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => setFilters({ start: "", end: "", query: "", type: "全部", level: "全部" });

  return <Page>
    <TitleRow><div><h1>风险事件追溯中心</h1><span>还原事件轨迹、责任链与闭环证据</span></div><RefreshButton type="button" onClick={() => load(true)} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} />刷新</RefreshButton></TitleRow>
    <FilterBar>
      <FilterGroup><span>发生时间</span><input type="date" value={filters.start} onChange={(e) => updateFilter("start", e.target.value)} /><b>至</b><input type="date" value={filters.end} onChange={(e) => updateFilter("end", e.target.value)} /></FilterGroup>
      <SearchBox><UserRound size={14} /><input value={filters.query} onChange={(e) => updateFilter("query", e.target.value)} placeholder="人员、设备、事件编号" /><Search size={14} /></SearchBox>
      <FilterGroup><span>事件类型</span><select value={filters.type} onChange={(e) => updateFilter("type", e.target.value)}><option>全部</option>{[...new Set(events.map((item) => item.type))].map((value) => <option key={value}>{value}</option>)}</select></FilterGroup>
      <FilterGroup><span>风险等级</span><select value={filters.level} onChange={(e) => updateFilter("level", e.target.value)}><option>全部</option>{[...new Set(events.map((item) => item.level))].map((value) => <option key={value}>{value}</option>)}</select></FilterGroup>
      <ResetButton type="button" onClick={resetFilters}><RotateCcw size={14} />重置</ResetButton><QueryCount>{filtered.length} 条事件</QueryCount>
    </FilterBar>

    <Workspace>
      <TopGrid>
        <EventPanel>
          <PanelHeader><div><strong>事件列表</strong><span>共 {filtered.length} 条</span></div><small>风险优先</small></PanelHeader>
          <EventTableHead><span>发生时间</span><span>人员 / 设备</span><span>事件类型</span><span>风险</span></EventTableHead>
          <EventList>{loading && !payload ? <Empty>风险事件加载中...</Empty> : error ? <Empty $error>{error}</Empty> : pageItems.length ? pageItems.map((event) => <EventRow key={event.id} type="button" $active={selected?.id === event.id} onClick={() => setSelectedId(event.id)}><time>{formatDateTime(event.time, false)}</time><span title={event.subject?.name}>{event.subject?.name || event.area?.name || "区域事件"}</span><strong title={event.type}><DynamicAlarmType value={event.type} /></strong><DynamicLevelBadge level={event.level} /></EventRow>) : <Empty>暂无匹配事件</Empty>}</EventList>
          <Pagination><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={14} /></button><span>{page} / {pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}><ChevronRight size={14} /></button></Pagination>
        </EventPanel>

        <MapPanel>
          <PanelHeader><div><strong>事件轨迹回放</strong><span>{selected ? `${selected.area?.name} · ${track.length || 1} 个轨迹点` : "请选择事件"}</span></div><MapLegend><i />低风险<i className="medium" />中风险<i className="high" />高风险</MapLegend></PanelHeader>
          <MapBody>{selected ? <RiskEventTraceMap event={selected} areas={payload?.areas ?? []} activeIndex={activeIndex} /> : <Empty>请选择事件</Empty>}</MapBody>
          <Playback><button type="button" disabled={track.length < 2} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={15} /> : <Play size={15} />}</button><input type="range" min="0" max={Math.max(0, track.length - 1)} value={Math.min(activeIndex, Math.max(0, track.length - 1))} onChange={(e) => { setPlaying(false); setActiveIndex(Number(e.target.value)); }} /><time>{formatDateTime(track[activeIndex]?.timestamp || selected?.time)}</time></Playback>
        </MapPanel>

        <DetailPanel>{selected ? <><PanelHeader><div><strong>事件详情</strong><span>{selected.type}　{selected.id}</span></div><AlarmLink to={`/alarm-center?alarm_id=${selected.id}`}>进入告警中心<ChevronRight size={13} /></AlarmLink></PanelHeader><DetailScroll>
          <DetailGrid><span>事件类型</span><strong><DynamicAlarmType value={selected.type} /></strong><span>风险等级</span><DynamicLevelBadge level={selected.level} /><span>关联对象</span><strong>{selected.subject?.name || "区域事件"}</strong><span>所在区域</span><strong>{selected.area?.name}</strong><span>开始时间</span><strong>{formatDateTime(selected.time)}</strong><span>持续时长</span><strong>{durationText(selected)}</strong><span>置信度</span><strong>{selected.confidence == null ? "--" : `${(selected.confidence * 100).toFixed(1)}%`}</strong><span>当前状态</span><StatusTag $closed={CLOSED_STATUSES.has(selected.status)}>{selected.status}</StatusTag></DetailGrid>
          <Description>{selected.description || "暂无事件描述"}</Description>
          <ChainTitle>责任追溯链</ChainTitle><ResponsibilityChain>{selected.logs?.length ? selected.logs.map((log) => <ChainItem key={log.id}><i /><div><strong>{log.operator_name || "系统"}</strong><span>{log.comment || `${log.from_status || "--"} → ${log.to_status || "--"}`}</span></div><time>{formatDateTime(log.create_time, false)}</time></ChainItem>) : <ChainEmpty>事件尚无人工操作记录</ChainEmpty>}</ResponsibilityChain>
        </DetailScroll></> : <Empty>请选择事件</Empty>}</DetailPanel>
      </TopGrid>

      <BottomGrid>
        <MilestonePanel><SectionHeader><div><strong>事件里程碑</strong><span>从识别到关闭的关键节点</span></div><b>{milestones.filter((item) => item.done).length}/{milestones.length || 6} 已完成</b></SectionHeader><MilestoneTrack>{milestones.map((item, index) => <Milestone key={item.label} $done={item.done}><time>{formatDateTime(item.time, false)}</time><div><i>{item.done ? <Check size={12} /> : index + 1}</i></div><strong>{item.label}</strong><span title={item.detail}>{item.detail}</span></Milestone>)}</MilestoneTrack></MilestonePanel>
        <EvidencePanel><SectionHeader><div><strong>判定依据与闭环证据</strong><span>仅展示数据库已有事实与材料</span></div><FileCheck2 size={16} /></SectionHeader><EvidenceBody><Reasoning><h3><Bot size={14} />智能判定依据</h3><p><ShieldCheck size={13} />{selected?.advice?.content || selected?.description || "暂无事件判定描述"}</p><p><MapPin size={13} />发生于 {selected?.area?.name || "未标注区域"}，关联 {selected?.subject?.name || "区域事件"}</p><p><AlertTriangle size={13} />风险等级 {selected?.level || "--"}，置信度 {selected?.confidence == null ? "--" : `${(selected.confidence * 100).toFixed(1)}%`}</p></Reasoning><EvidenceList><h3>原始证据</h3>{Array.isArray(selected?.evidence) && selected.evidence.length ? selected.evidence.slice(0, 5).map((item, index) => <EvidenceItem key={item.id || index}><FileCheck2 size={14} /><span>{item.name || item.type || `证据 ${index + 1}`}</span><b>{item.source || "系统留存"}</b></EvidenceItem>) : <ChainEmpty>该事件暂无附件或视频证据</ChainEmpty>}</EvidenceList></EvidenceBody></EvidencePanel>
      </BottomGrid>
    </Workspace>
  </Page>;
}

const Page = styled.div`box-sizing:border-box;height:100%;min-height:0;display:grid;grid-template-rows:auto 50px minmax(0,1fr);gap:10px;padding:${BUSINESS_PAGE_LAYOUT.padding};overflow:hidden;background:hsl(216 26% 97%);color:hsl(218 24% 18%);`;
const TitleRow = styled.div`display:flex;align-items:center;justify-content:space-between;h1{margin:0;font-size:17px}span{margin-left:12px;color:hsl(218 10% 50%);font-size:11px}>div{display:flex;align-items:baseline}`;
const RefreshButton = styled.button`height:32px;display:flex;align-items:center;gap:6px;padding:0 11px;border:1px solid hsl(220 14% 84%);border-radius:5px;background:white;font-size:11px;&:disabled{opacity:.6}.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`;
const FilterBar = styled.div`display:flex;align-items:center;gap:12px;padding:7px 12px;border:1px solid hsl(220 15% 88%);border-radius:6px;background:white;`;
const FilterGroup = styled.label`display:flex;align-items:center;gap:7px;>span{font-size:11px;font-weight:600;white-space:nowrap}b{color:hsl(218 10% 55%);font-size:10px}input,select{height:30px;border:1px solid hsl(220 14% 84%);border-radius:4px;padding:0 8px;background:white;font-size:11px;outline:0}select{min-width:112px}`;
const SearchBox = styled.label`width:245px;height:30px;display:flex;align-items:center;gap:6px;padding:0 8px;border:1px solid hsl(220 14% 84%);border-radius:4px;color:hsl(218 10% 50%);input{min-width:0;flex:1;border:0;outline:0;font-size:11px}`;
const ResetButton = styled.button`height:30px;display:flex;align-items:center;gap:5px;padding:0 10px;border:1px solid hsl(220 14% 84%);border-radius:4px;background:white;font-size:11px;`;
const QueryCount = styled.span`margin-left:auto;color:hsl(216 80% 48%);font-size:11px;font-weight:700;`;
const Workspace = styled.div`min-height:0;display:grid;grid-template-rows:minmax(0,1.55fr) minmax(225px,.72fr);gap:10px;`;
const TopGrid = styled.div`min-height:0;display:grid;grid-template-columns:430px minmax(0,1fr) 350px;gap:10px;`;
const BottomGrid = styled.div`min-height:0;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:10px;`;
const EventPanel = styled.section`min-height:0;display:grid;grid-template-rows:43px 31px minmax(0,1fr) 38px;border:1px solid hsl(220 15% 88%);border-radius:6px;background:white;overflow:hidden;`;
const MapPanel = styled.section`min-width:0;min-height:0;display:grid;grid-template-rows:43px minmax(0,1fr) 42px;border:1px solid hsl(220 15% 88%);border-radius:6px;background:white;overflow:hidden;`;
const DetailPanel = styled.section`min-width:0;min-height:0;display:grid;grid-template-rows:43px minmax(0,1fr);border:1px solid hsl(220 15% 88%);border-radius:6px;background:white;overflow:hidden;`;
const PanelHeader = styled.header`display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 12px;border-bottom:1px solid hsl(220 15% 90%);>div{min-width:0;display:flex;align-items:baseline;gap:8px}strong{font-size:13px;white-space:nowrap}span,small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:hsl(218 10% 50%);font-size:9px}`;
const EventTableHead = styled.div`display:grid;grid-template-columns:1.15fr 1fr 1fr 48px;gap:7px;align-items:center;padding:0 11px;background:hsl(216 30% 98%);color:hsl(218 10% 48%);font-size:10px;`;
const EventList = styled.div`min-height:0;overflow:auto;`;
const EventRow = styled.button`width:100%;height:48px;display:grid;grid-template-columns:1.15fr 1fr 1fr 48px;align-items:center;gap:7px;padding:0 11px;border:0;border-bottom:1px solid hsl(220 15% 92%);text-align:left;background:${(p)=>p.$active?"hsl(216 92% 95%)":"white"};box-shadow:${(p)=>p.$active?"inset 3px 0 #2563eb":"none"};color:inherit;font-size:10px;time,span,strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}strong{font-size:11px}&:hover{background:hsl(216 45% 97%)}`;
const LevelBadge = styled.span`width:fit-content;display:inline-flex;justify-content:center;border:1px solid ${(p)=>p.$color || (["重大","严重"].includes(p.$level)?"#fecaca":"#fed7aa")};border-radius:4px;padding:2px 6px;color:${(p)=>p.$color || (["重大","严重"].includes(p.$level)?"#dc2626":"#d97706")};background:${(p)=>p.$color ? `color-mix(in srgb, ${p.$color} 12%, white)` : (["重大","严重"].includes(p.$level)?"#fef2f2":"#fff7ed")};font-size:9px;font-weight:700;white-space:nowrap;`;
const Pagination = styled.footer`display:flex;align-items:center;justify-content:center;gap:12px;border-top:1px solid hsl(220 15% 90%);font-size:10px;button{width:26px;height:25px;display:grid;place-items:center;border:1px solid hsl(220 14% 85%);border-radius:4px;background:white}button:disabled{opacity:.4}`;
const MapBody = styled.div`min-height:0;overflow:hidden;`;
const MapLegend = styled.div`display:flex;align-items:center;gap:6px;color:hsl(218 10% 48%);font-size:9px;i{width:6px;height:6px;border-radius:50%;background:#10b981}.medium{background:#f59e0b}.high{background:#ef4444}`;
const Playback = styled.div`display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:10px;padding:0 11px;border-top:1px solid hsl(220 15% 90%);button{width:27px;height:27px;display:grid;place-items:center;border:0;border-radius:50%;color:white;background:#2563eb}button:disabled{background:#94a3b8}input{width:100%;accent-color:#2563eb}time{color:hsl(218 10% 48%);font-size:9px;white-space:nowrap}`;
const AlarmLink = styled(Link)`display:flex;align-items:center;gap:3px;color:#2563eb;text-decoration:none;font-size:10px;font-weight:700;white-space:nowrap;`;
const DetailScroll = styled.div`min-height:0;padding:11px 12px;overflow:auto;`;
const DetailGrid = styled.div`display:grid;grid-template-columns:68px minmax(0,1fr);gap:8px 10px;align-items:center;span{color:hsl(218 10% 48%);font-size:10px}strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}`;
const StatusTag = styled.b`width:fit-content;padding:3px 7px;border-radius:4px;color:${(p)=>p.$closed?"#15803d":"#2563eb"};background:${(p)=>p.$closed?"#ecfdf5":"#eff6ff"};font-size:9px;`;
const Description = styled.p`margin:12px 0;padding:9px;border-left:3px solid #2563eb;background:hsl(216 80% 97%);color:hsl(218 14% 40%);font-size:10px;line-height:1.55;`;
const ChainTitle = styled.h3`margin:0 0 8px;font-size:11px;`;
const ResponsibilityChain = styled.div`display:grid;gap:0;`;
const ChainItem = styled.div`position:relative;min-height:44px;display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:7px;&:not(:last-child):before{content:"";position:absolute;left:4px;top:13px;bottom:-2px;width:1px;background:#cbd5e1}>i{width:9px;height:9px;margin-top:3px;border:2px solid #2563eb;border-radius:50%;background:white;z-index:1}>div{min-width:0;display:grid;align-content:start;gap:3px}strong{font-size:10px}span,time{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:hsl(218 10% 50%);font-size:9px}`;
const ChainEmpty = styled.div`padding:12px 0;color:hsl(218 10% 52%);font-size:10px;`;
const MilestonePanel = styled.section`min-width:0;min-height:0;display:grid;grid-template-rows:43px minmax(0,1fr);border:1px solid hsl(220 15% 88%);border-radius:6px;background:white;overflow:hidden;`;
const EvidencePanel = styled(MilestonePanel)``;
const SectionHeader = styled.header`display:flex;align-items:center;justify-content:space-between;padding:0 13px;border-bottom:1px solid hsl(220 15% 90%);>div{display:flex;align-items:baseline;gap:8px}strong{font-size:12px}span{color:hsl(218 10% 50%);font-size:9px}b{padding:3px 6px;border-radius:4px;color:#2563eb;background:#eff6ff;font-size:9px}`;
const MilestoneTrack = styled.div`position:relative;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));align-items:center;padding:12px 14px;&:before{content:"";position:absolute;left:8%;right:8%;top:76px;height:2px;background:#dbe3ee}`;
const Milestone = styled.div`position:relative;z-index:1;min-width:0;display:grid;justify-items:center;gap:7px;text-align:center;time{color:hsl(218 10% 48%);font-size:9px}>div{width:100%;display:grid;place-items:center}i{width:22px;height:22px;display:grid;place-items:center;border:2px solid ${(p)=>p.$done?"#2563eb":"#cbd5e1"};border-radius:50%;color:${(p)=>p.$done?"white":"#64748b"};background:${(p)=>p.$done?"#2563eb":"white"};font-size:9px;font-style:normal}strong{font-size:10px}span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:hsl(218 10% 50%);font-size:9px}`;
const EvidenceBody = styled.div`min-height:0;display:grid;grid-template-columns:1.1fr .9fr;gap:12px;padding:10px 13px;overflow:auto;`;
const Reasoning = styled.div`min-width:0;padding-right:12px;border-right:1px solid hsl(220 15% 90%);h3{display:flex;align-items:center;gap:6px;margin:0 0 8px;font-size:11px}p{display:flex;align-items:flex-start;gap:6px;margin:6px 0;color:hsl(218 12% 42%);font-size:9px;line-height:1.45}svg{flex:0 0 auto;color:#10b981}`;
const EvidenceList = styled.div`min-width:0;h3{margin:0 0 6px;font-size:11px}`;
const EvidenceItem = styled.div`display:grid;grid-template-columns:16px minmax(0,1fr) auto;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid hsl(220 15% 92%);span,b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}b{color:hsl(218 10% 50%);font-weight:500}`;
const Empty = styled.div`height:100%;display:grid;place-items:center;color:${(p)=>p.$error?"#dc2626":"hsl(218 10% 52%)"};font-size:11px;`;

export default RiskEventTraceability;
