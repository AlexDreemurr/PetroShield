import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import styled from "styled-components";
import {
  AlertTriangle,
  Archive,
  Bot,
  Check,
  ChevronRight,
  ClipboardCheck,
  Database,
  FileCheck2,
  Filter,
  RadioTower,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserCheck,
  Wrench,
} from "lucide-react";
import { BUSINESS_PAGE_LAYOUT } from "../constants/STYLES";
import { getCachedJson, loadCachedJson, PAGE_DATA_URLS } from "../services/pageDataCache";

const LEVEL_ORDER = { 重大: 3, 严重: 2, 中等: 1, 一般: 0 };
const CLOSED_STATUSES = new Set(["关闭", "误报"]);

const STAGE_DEFINITIONS = [
  { key: "collect", label: "数据采集", icon: Database, group: "系统识别" },
  { key: "judge", label: "规则判断", icon: ShieldCheck, group: "系统识别" },
  { key: "create", label: "告警生成", icon: AlertTriangle, group: "系统识别" },
  { key: "grade", label: "自动分级", icon: RadioTower, group: "系统识别" },
  { key: "notify", label: "通知人员", icon: Send, group: "系统识别" },
  { key: "confirm", label: "人工确认", icon: UserCheck, group: "处置闭环", action: "confirm" },
  { key: "dispatch", label: "派单处理", icon: ClipboardCheck, group: "处置闭环", action: "dispatch" },
  { key: "handle", label: "现场处置", icon: Wrench, group: "处置闭环", action: "submit_feedback" },
  { key: "review", label: "结果复核", icon: FileCheck2, group: "处置闭环", actions: ["review_approve", "review_reject"] },
  { key: "archive", label: "关闭归档", icon: Archive, group: "处置闭环", actions: ["close", "mark_false_positive"] },
];

function formatDateTime(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(new Date(value)).replaceAll("/", "-");
}

function findLog(event, stage) {
  const actions = stage.actions ?? (stage.action ? [stage.action] : []);
  return event.logs?.find((log) => actions.includes(log.action)) ?? null;
}

function buildLifecycle(event) {
  const systemDetails = {
    collect: event.subject ? `${event.subject.name} / ${event.subject.meta || "现场数据源"}` : "区域与视频融合数据",
    judge: event.description || `${event.type}规则命中`,
    create: `生成事件 ${event.id}`,
    grade: `风险等级判定为${event.level}`,
    notify: "告警中心已进入待办队列",
  };
  const systemTimes = {
    collect: event.time,
    judge: event.time,
    create: event.create_time || event.time,
    grade: event.create_time || event.time,
    notify: event.create_time || event.time,
  };

  const stages = STAGE_DEFINITIONS.map((stage) => {
    if (systemDetails[stage.key]) {
      return { ...stage, state: "done", detail: systemDetails[stage.key], time: systemTimes[stage.key], source: "系统自动" };
    }
    const log = findLog(event, stage);
    if (log) {
      return {
        ...stage,
        state: "done",
        detail: log.comment || `${log.operator_name || "系统"}完成${stage.label}`,
        time: log.create_time,
        source: log.operator_name || "操作留痕",
      };
    }
    if (stage.key === "dispatch" && event.assignment) {
      return { ...stage, state: "done", detail: event.assignment.instruction, time: event.assignment.assigned_at, source: event.assignment.assigned_by };
    }
    if (stage.key === "handle" && event.assignment?.completed_at) {
      return { ...stage, state: "done", detail: event.assignment.feedback || "现场处置完成", time: event.assignment.completed_at, source: event.assignment.assignee_name || "处置人员" };
    }
    if (stage.key === "archive" && CLOSED_STATUSES.has(event.status)) {
      return { ...stage, state: "done", detail: `事件以“${event.status}”状态归档`, time: event.update_time, source: "系统归档" };
    }
    return { ...stage, state: "pending", detail: "等待前序环节完成", time: null, source: "待留痕" };
  });

  const firstPending = stages.findIndex((stage) => stage.state === "pending");
  if (firstPending >= 0) stages[firstPending].state = "current";
  return stages;
}

function Metric({ label, value, tone = "blue" }) {
  return <MetricItem $tone={tone}><span>{label}</span><strong>{value}</strong></MetricItem>;
}

function FlowGroup({ title, stages }) {
  return (
    <FlowGroupBox>
      <FlowGroupTitle>{title}<span>{stages.filter((stage) => stage.state === "done").length}/5</span></FlowGroupTitle>
      <FlowList>
        {stages.map((stage) => {
          const Icon = stage.icon;
          return (
            <FlowStep key={stage.key} $state={stage.state}>
              <StepRail><StepIcon $state={stage.state}>{stage.state === "done" ? <Check size={14} /> : <Icon size={14} />}</StepIcon></StepRail>
              <StepContent>
                <div><strong>{stage.label}</strong><StepSource>{stage.source}</StepSource></div>
                <p>{stage.detail}</p>
                <time>{formatDateTime(stage.time)}</time>
              </StepContent>
            </FlowStep>
          );
        })}
      </FlowList>
    </FlowGroupBox>
  );
}

function RiskEventTraceability() {
  const initialPayload = getCachedJson(PAGE_DATA_URLS.riskEvents);
  const initialPayloadRef = useRef(initialPayload);
  const [payload, setPayload] = useState(initialPayload);
  const [loading, setLoading] = useState(!initialPayload);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(initialPayload?.items?.[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [levelFilter, setLevelFilter] = useState("全部");

  async function loadEvents(force = false) {
    const cached = getCachedJson(PAGE_DATA_URLS.riskEvents);
    if (!cached) setLoading(true);
    setError("");
    try {
      const next = await loadCachedJson(PAGE_DATA_URLS.riskEvents, { force });
      setPayload(next);
      setSelectedId((current) => current && next.items.some((item) => item.id === current) ? current : next.items[0]?.id ?? null);
    } catch {
      if (!cached) setError("风险事件数据加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEvents(Boolean(initialPayloadRef.current)); }, []);

  const events = useMemo(() => payload?.items ?? [], [payload]);
  const filteredEvents = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return events.filter((event) => {
      const matchesStatus = statusFilter === "全部" || event.status === statusFilter;
      const matchesLevel = levelFilter === "全部" || event.level === levelFilter;
      const haystack = [event.id, event.type, event.description, event.area?.name, event.subject?.name].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && matchesLevel && (!keyword || haystack.includes(keyword));
    }).sort((a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level] || new Date(b.time) - new Date(a.time));
  }, [events, levelFilter, query, statusFilter]);
  const selectedEvent = events.find((event) => event.id === selectedId) ?? filteredEvents[0] ?? null;
  const lifecycle = selectedEvent ? buildLifecycle(selectedEvent) : [];
  const summary = payload?.summary ?? {};

  return (
    <Page>
      <TitleRow>
        <div><h1>风险事件追溯</h1><span>事件识别、处置、复核与归档全流程留痕</span></div>
        <RefreshButton type="button" onClick={() => loadEvents(true)} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} />刷新</RefreshButton>
      </TitleRow>

      <Metrics>
        <Metric label="事件总数" value={payload?.total ?? 0} />
        <Metric label="处置中" value={summary.processing ?? 0} tone="orange" />
        <Metric label="已闭环" value={summary.closed ?? 0} tone="green" />
        <Metric label="严重及重大" value={summary.major ?? 0} tone="red" />
        <Metric label="闭环率" value={`${summary.closure_rate ?? 0}%`} tone="cyan" />
      </Metrics>

      <FilterBar>
        <Filter size={15} />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option>全部</option>{[...new Set(events.map((item) => item.status))].map((value) => <option key={value}>{value}</option>)}
        </select>
        <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
          <option>全部</option>{[...new Set(events.map((item) => item.level))].map((value) => <option key={value}>{value}</option>)}
        </select>
        <SearchBox><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索事件编号、类型、区域或对象" /></SearchBox>
        <ResultCount>共 {filteredEvents.length} 条事件</ResultCount>
      </FilterBar>

      <Workspace>
        <EventPanel>
          <PanelHeader><strong>事件记录</strong><span>按风险等级与时间排序</span></PanelHeader>
          <EventTableHeader><span>事件</span><span>区域 / 对象</span><span>状态</span></EventTableHeader>
          <EventList>
            {loading && !payload ? <EmptyState>风险事件加载中...</EmptyState> : error ? <EmptyState>{error}</EmptyState> : filteredEvents.length === 0 ? <EmptyState>暂无匹配事件</EmptyState> : filteredEvents.map((event) => (
              <EventRow key={event.id} type="button" $active={selectedEvent?.id === event.id} onClick={() => setSelectedId(event.id)}>
                <EventMain><div><LevelBadge $level={event.level}>{event.level}</LevelBadge><strong>{event.type}</strong></div><span>{formatDateTime(event.time)} · {event.id}</span></EventMain>
                <EventLocation><strong>{event.area?.name}</strong><span>{event.subject?.name || "区域事件"}</span></EventLocation>
                <StatusBadge $status={event.status}>{event.status}</StatusBadge>
                <ChevronRight size={15} />
              </EventRow>
            ))}
          </EventList>
        </EventPanel>

        <DetailPanel>
          {selectedEvent ? (
            <>
              <DetailHeader>
                <div><span>{selectedEvent.id}</span><h2>{selectedEvent.type}</h2><p>{selectedEvent.description || "暂无事件描述"}</p></div>
                <HeaderActions><LevelBadge $level={selectedEvent.level}>{selectedEvent.level}</LevelBadge><StatusBadge $status={selectedEvent.status}>{selectedEvent.status}</StatusBadge><AlarmLink to={`/alarm-center?alarm_id=${selectedEvent.id}`}>进入告警中心<ChevronRight size={14} /></AlarmLink></HeaderActions>
              </DetailHeader>
              <MetaStrip>
                <div><span>发生区域</span><strong>{selectedEvent.area?.name}</strong></div>
                <div><span>关联对象</span><strong>{selectedEvent.subject?.name || "区域事件"}</strong></div>
                <div><span>发生时间</span><strong>{formatDateTime(selectedEvent.time)}</strong></div>
                <div><span>AI 置信度</span><strong>{selectedEvent.confidence == null ? "--" : `${(selectedEvent.confidence * 100).toFixed(1)}%`}</strong></div>
              </MetaStrip>
              <DetailBody>
                <TraceSection>
                  <SectionTitle><div><strong>完整事件流程</strong><span>依据操作日志还原，未完成环节保留待办状态</span></div><TraceCount>{lifecycle.filter((stage) => stage.state === "done").length}/10 已完成</TraceCount></SectionTitle>
                  <FlowColumns>
                    <FlowGroup title="系统识别" stages={lifecycle.slice(0, 5)} />
                    <FlowGroup title="处置闭环" stages={lifecycle.slice(5)} />
                  </FlowColumns>
                </TraceSection>
                <RecordColumn>
                  <RecordBlock><RecordTitle><ClipboardCheck size={15} />派单与现场反馈</RecordTitle>{selectedEvent.assignment ? <RecordText><strong>{selectedEvent.assignment.assignee_name || selectedEvent.assignment.department || "待接单"}</strong><span>{selectedEvent.assignment.instruction}</span><p>{selectedEvent.assignment.feedback || "尚未提交现场处置反馈"}</p></RecordText> : <RecordEmpty>该事件尚未派发处理</RecordEmpty>}</RecordBlock>
                  <RecordBlock><RecordTitle><Bot size={15} />AI 处置建议</RecordTitle>{selectedEvent.advice ? <RecordText><strong>{selectedEvent.advice.model || selectedEvent.advice.source}</strong><p>{selectedEvent.advice.content}</p></RecordText> : <RecordEmpty>确认告警后生成处置建议</RecordEmpty>}</RecordBlock>
                  <RecordBlock><RecordTitle><FileCheck2 size={15} />证据与审计</RecordTitle><AuditRows><span>原始证据 <strong>{Array.isArray(selectedEvent.evidence) ? selectedEvent.evidence.length : 0} 项</strong></span><span>操作日志 <strong>{selectedEvent.logs?.length ?? 0} 条</strong></span><span>最后更新 <strong>{formatDateTime(selectedEvent.update_time)}</strong></span></AuditRows></RecordBlock>
                </RecordColumn>
              </DetailBody>
            </>
          ) : <EmptyState>请选择一条风险事件</EmptyState>}
        </DetailPanel>
      </Workspace>
    </Page>
  );
}

const Page = styled.div`box-sizing:border-box;height:100%;min-height:0;display:grid;grid-template-rows:auto 64px 42px minmax(0,1fr);gap:10px;padding:${BUSINESS_PAGE_LAYOUT.padding};overflow:hidden;background:hsl(216 26% 97%);color:hsl(218 24% 18%);`;
const TitleRow = styled.div`display:flex;align-items:center;justify-content:space-between;min-height:28px;h1{margin:0;font-size:16px;line-height:1.2;}span{color:hsl(218 10% 50%);font-size:11px;} > div{display:flex;align-items:baseline;gap:12px;}`;
const RefreshButton = styled.button`height:32px;border:1px solid hsl(220 14% 85%);border-radius:5px;padding:0 12px;display:flex;align-items:center;gap:7px;background:white;color:hsl(218 18% 28%);font-size:12px;font-weight:600;&:disabled{opacity:.6}.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`;
const Metrics = styled.div`display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border:1px solid hsl(220 15% 89%);border-radius:6px;background:white;overflow:hidden;`;
const MetricItem = styled.div`position:relative;display:flex;align-items:center;justify-content:space-between;padding:0 20px;border-right:1px solid hsl(220 15% 91%);&:last-child{border-right:0}&:before{content:"";position:absolute;left:0;top:16px;bottom:16px;width:3px;background:${({$tone})=>({red:"#ef4444",orange:"#f59e0b",green:"#10b981",cyan:"#06b6d4"}[$tone]||"#2563eb")};}span{font-size:12px;color:hsl(218 10% 48%)}strong{font-size:23px;font-weight:700;}`;
const FilterBar = styled.div`display:flex;align-items:center;gap:9px;border:1px solid hsl(220 15% 89%);border-radius:6px;padding:4px 10px;background:white;color:hsl(218 10% 48%);select{height:30px;min-width:110px;border:1px solid hsl(220 14% 86%);border-radius:4px;padding:0 9px;background:white;color:hsl(218 16% 28%);font-size:12px;outline:none;}`;
const SearchBox = styled.label`width:300px;height:30px;display:flex;align-items:center;gap:7px;border:1px solid hsl(220 14% 86%);border-radius:4px;padding:0 9px;input{min-width:0;flex:1;border:0;outline:0;font-size:12px;}`;
const ResultCount = styled.span`margin-left:auto;font-size:12px;`;
const Workspace = styled.div`min-height:0;display:grid;grid-template-columns:450px minmax(0,1fr);gap:10px;`;
const EventPanel = styled.section`min-height:0;display:grid;grid-template-rows:47px 32px minmax(0,1fr);border:1px solid hsl(220 15% 89%);border-radius:6px;background:white;overflow:hidden;`;
const PanelHeader = styled.div`display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid hsl(220 15% 91%);strong{font-size:14px}span{font-size:11px;color:hsl(218 10% 52%)}`;
const EventTableHeader = styled.div`display:grid;grid-template-columns:1.5fr 1fr 66px;padding:0 28px 0 13px;align-items:center;background:hsl(216 26% 98%);color:hsl(218 10% 48%);font-size:11px;`;
const EventList = styled.div`min-height:0;overflow:auto;`;
const EventRow = styled.button`box-sizing:border-box;width:100%;height:70px;border:0;border-bottom:1px solid hsl(220 15% 92%);display:grid;grid-template-columns:1.5fr 1fr 66px 15px;align-items:center;gap:8px;padding:0 12px;text-align:left;background:${({$active})=>$active?"hsl(216 92% 97%)":"white"};box-shadow:${({$active})=>$active?"inset 3px 0 #2563eb":"none"};color:inherit;&:hover{background:hsl(216 26% 98%)}`;
const EventMain = styled.div`min-width:0;display:grid;gap:6px;>div{display:flex;align-items:center;gap:7px;min-width:0}strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:hsl(218 10% 50%);font-size:10px}`;
const EventLocation = styled.div`min-width:0;display:grid;gap:5px;strong,span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}strong{font-size:11px}span{font-size:10px;color:hsl(218 10% 52%)}`;
const LevelBadge = styled.span`width:fit-content;display:inline-flex;align-items:center;border:1px solid ${({$level})=>$level==="重大"||$level==="严重"?"hsl(0 80% 88%)":"hsl(34 90% 84%)"};border-radius:4px;padding:2px 6px;color:${({$level})=>$level==="重大"||$level==="严重"?"hsl(0 72% 50%)":"hsl(32 88% 45%)"};background:${({$level})=>$level==="重大"||$level==="严重"?"hsl(0 86% 97%)":"hsl(38 100% 96%)"};font-size:10px;font-weight:700;white-space:nowrap;`;
const StatusBadge = styled.span`width:fit-content;display:inline-flex;border-radius:4px;padding:3px 7px;color:${({$status})=>CLOSED_STATUSES.has($status)?"hsl(157 72% 35%)":"hsl(216 82% 50%)"};background:${({$status})=>CLOSED_STATUSES.has($status)?"hsl(157 60% 95%)":"hsl(216 90% 96%)"};font-size:10px;font-weight:700;white-space:nowrap;`;
const EmptyState = styled.div`height:100%;display:grid;place-items:center;color:hsl(218 10% 52%);font-size:13px;`;
const DetailPanel = styled.section`min-width:0;min-height:0;display:grid;grid-template-rows:auto 58px minmax(0,1fr);border:1px solid hsl(220 15% 89%);border-radius:6px;background:white;overflow:hidden;`;
const DetailHeader = styled.div`display:flex;align-items:center;justify-content:space-between;gap:20px;padding:13px 16px;border-bottom:1px solid hsl(220 15% 91%);>div:first-child{min-width:0}span{font-size:10px;color:hsl(218 10% 52%)}h2{display:inline;margin:0 10px 0 0;font-size:16px}p{display:inline;color:hsl(218 10% 46%);font-size:11px}`;
const HeaderActions = styled.div`display:flex;align-items:center;gap:8px;flex-shrink:0;`;
const AlarmLink = styled(Link)`height:28px;display:flex;align-items:center;gap:3px;border-radius:4px;padding:0 9px;color:white;background:#2563eb;text-decoration:none;font-size:11px;font-weight:600;`;
const MetaStrip = styled.div`display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid hsl(220 15% 91%);background:hsl(216 26% 99%);>div{display:grid;align-content:center;gap:4px;padding:0 15px;border-right:1px solid hsl(220 15% 91%)}span{font-size:10px;color:hsl(218 10% 52%)}strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}`;
const DetailBody = styled.div`min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 300px;overflow:hidden;`;
const TraceSection = styled.div`min-width:0;min-height:0;display:grid;grid-template-rows:50px minmax(0,1fr);padding:0 16px 14px;overflow:hidden;`;
const SectionTitle = styled.div`display:flex;align-items:center;justify-content:space-between;>div{display:flex;align-items:baseline;gap:9px}strong{font-size:13px}span{font-size:10px;color:hsl(218 10% 52%)}`;
const TraceCount = styled.span`border-radius:4px;padding:4px 7px;color:hsl(216 82% 48%)!important;background:hsl(216 90% 96%);font-weight:700;`;
const FlowColumns = styled.div`min-height:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;`;
const FlowGroupBox = styled.div`min-height:0;border:1px solid hsl(220 15% 90%);border-radius:6px;display:grid;grid-template-rows:38px minmax(0,1fr);overflow:hidden;`;
const FlowGroupTitle = styled.div`display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid hsl(220 15% 91%);background:hsl(216 26% 98%);font-size:12px;font-weight:700;span{font-size:10px;color:hsl(218 10% 50%)}`;
const FlowList = styled.div`min-height:0;padding:5px 11px;overflow:auto;`;
const FlowStep = styled.div`min-height:75px;display:grid;grid-template-columns:28px minmax(0,1fr);gap:8px;color:${({$state})=>$state==="pending"?"hsl(218 10% 58%)":"hsl(218 20% 22%)"};`;
const StepRail = styled.div`position:relative;display:flex;justify-content:center;&:after{content:"";position:absolute;top:28px;bottom:-5px;width:1px;background:hsl(220 14% 85%)}${FlowStep}:last-child &:after{display:none}`;
const StepIcon = styled.div`position:relative;z-index:1;width:25px;height:25px;border-radius:50%;display:grid;place-items:center;color:${({$state})=>$state==="done"?"white":$state==="current"?"#2563eb":"hsl(218 10% 55%)"};background:${({$state})=>$state==="done"?"#2563eb":$state==="current"?"hsl(216 90% 95%)":"hsl(220 14% 94%)"};border:1px solid ${({$state})=>$state==="current"?"#2563eb":"transparent"};`;
const StepContent = styled.div`min-width:0;padding-top:2px;>div{display:flex;align-items:center;justify-content:space-between;gap:8px}strong{font-size:11px}p{margin:4px 0 3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:hsl(218 10% 45%);font-size:10px}time{font-size:9px;color:hsl(218 10% 58%)}`;
const StepSource = styled.span`overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px!important;color:hsl(218 10% 55%)!important;`;
const RecordColumn = styled.aside`min-height:0;border-left:1px solid hsl(220 15% 91%);padding:12px;display:grid;align-content:start;gap:10px;overflow:auto;background:hsl(216 26% 99%);`;
const RecordBlock = styled.section`border:1px solid hsl(220 15% 89%);border-radius:5px;padding:11px;background:white;`;
const RecordTitle = styled.div`display:flex;align-items:center;gap:7px;margin-bottom:9px;color:hsl(218 20% 24%);font-size:11px;font-weight:700;`;
const RecordText = styled.div`display:grid;gap:5px;strong{font-size:11px}span{color:hsl(218 10% 43%);font-size:10px}p{margin:0;color:hsl(218 10% 48%);font-size:10px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;}`;
const RecordEmpty = styled.div`padding:8px 0;color:hsl(218 10% 55%);font-size:10px;`;
const AuditRows = styled.div`display:grid;gap:7px;span{display:flex;justify-content:space-between;color:hsl(218 10% 48%);font-size:10px}strong{color:hsl(218 18% 28%);font-weight:600}`;

export default RiskEventTraceability;
