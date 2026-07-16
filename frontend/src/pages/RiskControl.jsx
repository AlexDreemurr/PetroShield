import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  BellRing,
  Check,
  Circle,
  Cpu,
  MapPin,
  MapPinned,
  MousePointer2,
  Pentagon,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import RiskControlMap from "../components/RiskControlMap/RiskControlMap";
import { API_BASE_URL } from "../config/api";
import { COLORS, FONT_SIZES } from "../constants/STYLES";

const AREA_TYPES = {
  danger: { label: "危险区", tone: "red" },
  restricted: { label: "限制区", tone: "orange" },
  prohibited: { label: "禁入区", tone: "darkRed" },
  normal: { label: "普通区", tone: "green" },
};

const INITIAL_AREAS = [
  {
    id: "area-tank-a",
    name: "A区储罐围栏",
    code: "AREA-A-01",
    type: "danger",
    riskLevel: "高风险",
    shape: "polygon",
    polygon: [
      { x: 120, y: 80 },
      { x: 260, y: 80 },
      { x: 260, y: 210 },
      { x: 120, y: 210 },
    ],
    center: { x: 190, y: 145 },
    manager: "李四",
    department: "生产部",
    peopleCount: 6,
    deviceCount: 4,
    alertCount: 2,
    enabled: true,
    rules: {
      crossBoundary: true,
      dwellEnabled: true,
      dwellMinutes: 20,
      capacityEnabled: true,
      maxPeople: 12,
      priority: "高",
    },
  },
  {
    id: "area-loading-b",
    name: "B区装卸作业区",
    code: "AREA-B-02",
    type: "restricted",
    riskLevel: "中风险",
    shape: "polygon",
    polygon: [
      { x: 300, y: 120 },
      { x: 430, y: 120 },
      { x: 430, y: 260 },
      { x: 300, y: 260 },
    ],
    center: { x: 365, y: 190 },
    manager: "王五",
    department: "运维部",
    peopleCount: 9,
    deviceCount: 3,
    alertCount: 1,
    enabled: true,
    rules: {
      crossBoundary: true,
      dwellEnabled: true,
      dwellMinutes: 30,
      capacityEnabled: true,
      maxPeople: 15,
      priority: "中",
    },
  },
  {
    id: "area-pump-c",
    name: "C区泵房",
    code: "AREA-C-03",
    type: "restricted",
    riskLevel: "中风险",
    shape: "polygon",
    polygon: [
      { x: 500, y: 300 },
      { x: 610, y: 300 },
      { x: 610, y: 395 },
      { x: 500, y: 395 },
    ],
    center: { x: 555, y: 347.5 },
    manager: "赵六",
    department: "设备部",
    peopleCount: 4,
    deviceCount: 5,
    alertCount: 0,
    enabled: true,
    rules: {
      crossBoundary: true,
      dwellEnabled: true,
      dwellMinutes: 45,
      capacityEnabled: false,
      maxPeople: 10,
      priority: "中",
    },
  },
  {
    id: "area-chemical-store",
    name: "危化品仓库",
    code: "AREA-D-04",
    type: "prohibited",
    riskLevel: "高风险",
    shape: "circle",
    center: { x: 430, y: 62 },
    radius: 48,
    manager: "孙七",
    department: "安保部",
    peopleCount: 0,
    deviceCount: 3,
    alertCount: 1,
    enabled: true,
    rules: {
      crossBoundary: true,
      dwellEnabled: false,
      dwellMinutes: 5,
      capacityEnabled: true,
      maxPeople: 0,
      priority: "紧急",
    },
  },
  {
    id: "area-office",
    name: "综合办公区",
    code: "AREA-O-05",
    type: "normal",
    riskLevel: "低风险",
    shape: "polygon",
    polygon: [
      { x: 40, y: 40 },
      { x: 105, y: 40 },
      { x: 105, y: 105 },
      { x: 40, y: 105 },
    ],
    center: { x: 72.5, y: 72.5 },
    manager: "周八",
    department: "行政部",
    peopleCount: 18,
    deviceCount: 2,
    alertCount: 0,
    enabled: true,
    rules: {
      crossBoundary: false,
      dwellEnabled: false,
      dwellMinutes: 60,
      capacityEnabled: true,
      maxPeople: 50,
      priority: "低",
    },
  },
];

const RISK_LEVEL_LABELS = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const RISK_LEVEL_VALUES = {
  低风险: "low",
  中风险: "medium",
  高风险: "high",
};

const PRIORITY_LABELS = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};

const PRIORITY_VALUES = {
  低: "low",
  中: "medium",
  高: "high",
  紧急: "urgent",
};

function normalizeApiArea(item) {
  return {
    id: item.id,
    name: item.name,
    code: String(item.id).toUpperCase(),
    type: item.type,
    riskLevel: RISK_LEVEL_LABELS[item.risk_level] ?? "低风险",
    shape: item.shape,
    polygon: item.polygon ?? [],
    center: item.center,
    radius: item.radius,
    manager: item.manager?.name ?? "待指定",
    department: item.manager?.department ?? "待指定",
    peopleCount: item.people_count ?? 0,
    deviceCount: item.device_count ?? 0,
    alertCount: item.alert_count ?? 0,
    enabled: item.enabled,
    rules: {
      crossBoundary: item.rules?.cross_boundary ?? false,
      dwellEnabled: item.rules?.dwell_enabled ?? false,
      dwellMinutes: item.rules?.dwell_minutes ?? 30,
      capacityEnabled: item.rules?.capacity_enabled ?? false,
      maxPeople: item.rules?.max_people ?? 10,
      priority: PRIORITY_LABELS[item.rules?.priority] ?? "中",
    },
    isNew: false,
  };
}

function buildAreaPayload(area) {
  return {
    name: area.name.trim(),
    type: area.type,
    risk_level: RISK_LEVEL_VALUES[area.riskLevel] ?? "low",
    shape: area.shape,
    polygon: area.polygon ?? [],
    center: area.center ?? null,
    radius: area.shape === "circle" ? area.radius : null,
    enabled: area.enabled,
    manager_name: area.manager,
    manager_department: area.department,
    rules: {
      cross_boundary: area.rules.crossBoundary,
      dwell_enabled: area.rules.dwellEnabled,
      dwell_minutes: area.rules.dwellMinutes,
      capacity_enabled: area.rules.capacityEnabled,
      max_people: area.rules.maxPeople,
      priority: PRIORITY_VALUES[area.rules.priority] ?? "medium",
    },
  };
}

function Toggle({ checked, onChange, label }) {
  return (
    <ToggleButton
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      $checked={checked}
      onClick={() => onChange(!checked)}
    >
      <ToggleThumb $checked={checked} />
    </ToggleButton>
  );
}

function MetricCard({ icon: Icon, label, value, unit, tone }) {
  return (
    <Metric>
      <MetricIcon $tone={tone}>
        <Icon size={19} strokeWidth={2} />
      </MetricIcon>
      <MetricCopy>
        <MetricLabel>{label}</MetricLabel>
        <MetricValue>
          {value}<span>{unit}</span>
        </MetricValue>
      </MetricCopy>
    </Metric>
  );
}

function RiskControl() {
  const [areas, setAreas] = useState(INITIAL_AREAS);
  const [selectedAreaId, setSelectedAreaId] = useState(INITIAL_AREAS[0].id);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [drawMode, setDrawMode] = useState(null);
  const [draft, setDraft] = useState(INITIAL_AREAS[0]);
  const [savedMessage, setSavedMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [draftPointCount, setDraftPointCount] = useState(0);
  const [confirmDrawToken, setConfirmDrawToken] = useState(0);
  const [managerOptions, setManagerOptions] = useState([
    { name: "李四", department: "生产部" },
    { name: "王五", department: "运维部" },
    { name: "赵六", department: "设备部" },
    { name: "孙七", department: "安保部" },
    { name: "周八", department: "行政部" },
  ]);

  useEffect(() => {
    let isMounted = true;

    fetch(`${API_BASE_URL}/risk-control/overview`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load risk control data");
        return response.json();
      })
      .then((payload) => {
        if (!isMounted) return;
        const nextAreas = (payload.items ?? []).map(normalizeApiArea);
        if (nextAreas.length > 0) {
          setAreas(nextAreas);
          setSelectedAreaId(nextAreas[0].id);
        }
        if (payload.managers?.length > 0) {
          setManagerOptions(payload.managers);
        }
      })
      .catch(() => {
        // Keep the seeded frontend snapshot available when the API is offline.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedArea = useMemo(
    () => areas.find((area) => area.id === selectedAreaId) ?? areas[0],
    [areas, selectedAreaId]
  );

  useEffect(() => {
    if (selectedArea) setDraft(selectedArea);
  }, [selectedArea]);

  useEffect(() => {
    if (!savedMessage) return undefined;
    const timer = window.setTimeout(() => setSavedMessage(""), 1800);
    return () => window.clearTimeout(timer);
  }, [savedMessage]);

  const visibleAreas = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return areas.filter((area) => {
      const matchesType = typeFilter === "all" || area.type === typeFilter;
      const matchesKeyword =
        !normalizedKeyword ||
        [area.name, area.code, area.manager]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedKeyword));
      return matchesType && matchesKeyword;
    });
  }, [areas, keyword, typeFilter]);

  const metrics = useMemo(
    () => ({
      activeAreas: areas.filter((area) => area.enabled).length,
      highRiskAreas: areas.filter((area) => area.riskLevel === "高风险").length,
      activeRules: areas.reduce(
        (total, area) =>
          total +
          Number(area.rules.crossBoundary) +
          Number(area.rules.dwellEnabled) +
          Number(area.rules.capacityEnabled),
        0
      ),
      currentAlerts: areas.reduce((total, area) => total + area.alertCount, 0),
    }),
    [areas]
  );

  const handleAreaSelect = useCallback((id) => {
    setSelectedAreaId(id);
    setDrawMode(null);
    setDraftPointCount(0);
  }, []);

  const handleDrawComplete = useCallback((geometry) => {
    const nextIndex = areas.length + 1;
    const id = `area-custom-${Date.now()}`;
    const nextArea = {
      id,
      name: `新建风险区域 ${nextIndex}`,
      code: `AREA-N-${String(nextIndex).padStart(2, "0")}`,
      type: "restricted",
      riskLevel: "中风险",
      manager: "待指定",
      department: "待指定",
      peopleCount: 0,
      deviceCount: 0,
      alertCount: 0,
      enabled: true,
      rules: {
        crossBoundary: true,
        dwellEnabled: true,
        dwellMinutes: 30,
        capacityEnabled: false,
        maxPeople: 10,
        priority: "中",
      },
      isNew: true,
      ...geometry,
    };
    setAreas((current) => [...current, nextArea]);
    setSelectedAreaId(id);
    setDrawMode(null);
    setDraftPointCount(0);
  }, [areas.length]);

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateRule = (key, value) => {
    setDraft((current) => ({
      ...current,
      rules: { ...current.rules, [key]: value },
    }));
  };

  const saveDraft = async () => {
    if (!draft.name.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        draft.isNew
          ? `${API_BASE_URL}/risk-control/areas`
          : `${API_BASE_URL}/risk-control/areas/${encodeURIComponent(draft.id)}`,
        {
          method: draft.isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildAreaPayload(draft)),
        }
      );
      if (!response.ok) throw new Error("Failed to save risk area");

      const savedArea = normalizeApiArea(await response.json());
      setAreas((current) =>
        current.map((area) => (area.id === draft.id ? savedArea : area))
      );
      setSelectedAreaId(savedArea.id);
      setDraft(savedArea);
      setSavedMessage("配置已保存");
    } catch {
      setSavedMessage("保存失败，请检查后端服务");
    } finally {
      setIsSaving(false);
    }
  };

  const removeAreaFromView = (areaId) => {
    const removedIndex = areas.findIndex((area) => area.id === areaId);
    const nextAreas = areas.filter((area) => area.id !== areaId);
    const nextSelection = nextAreas[Math.min(Math.max(removedIndex, 0), nextAreas.length - 1)];
    setAreas(nextAreas);
    setSelectedAreaId(nextSelection?.id ?? null);
    setDraft(nextSelection ?? null);
  };

  const deleteDraft = async () => {
    if (!draft || isDeleting) return;

    if (draft.isNew) {
      removeAreaFromView(draft.id);
      setDeleteDialogOpen(false);
      setSavedMessage("未保存区域已移除");
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/risk-control/areas/${encodeURIComponent(draft.id)}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to delete risk area");

      removeAreaFromView(draft.id);
      setDeleteDialogOpen(false);
      setSavedMessage("区域已删除");
    } catch {
      setSavedMessage("删除失败，请检查后端服务");
    } finally {
      setIsDeleting(false);
    }
  };

  const startDrawing = (mode) => {
    setDraftPointCount(0);
    setDrawMode(mode);
  };

  const handleDraftPointCountChange = useCallback((count) => {
    setDraftPointCount(count);
  }, []);

  return (
    <Wrapper>
      <PageHeader>
        <PageHeading>
          <PageTitle>风险管控</PageTitle>
          <PageSubtitle>电子围栏、区域分级与告警规则统一配置</PageSubtitle>
        </PageHeading>
        <HeaderActions>
          <SearchBox>
            <Search size={15} />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索区域名称、编号或负责人"
            />
          </SearchBox>
          <TypeSelect
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            aria-label="区域类型筛选"
          >
            <option value="all">全部区域</option>
            {Object.entries(AREA_TYPES).map(([key, item]) => (
              <option key={key} value={key}>{item.label}</option>
            ))}
          </TypeSelect>
          <PrimaryButton type="button" onClick={() => startDrawing("polygon")}>
            <Plus size={15} /> 新增区域
          </PrimaryButton>
        </HeaderActions>
      </PageHeader>

      <MetricGrid>
        <MetricCard icon={MapPinned} label="启用区域" value={metrics.activeAreas} unit="处" tone="blue" />
        <MetricCard icon={ShieldAlert} label="高风险区域" value={metrics.highRiskAreas} unit="处" tone="red" />
        <MetricCard icon={ShieldCheck} label="生效规则" value={metrics.activeRules} unit="条" tone="green" />
        <MetricCard icon={BellRing} label="区域告警" value={metrics.currentAlerts} unit="条" tone="orange" />
      </MetricGrid>

      <Workspace>
        <AreaPanel>
          <PanelHeader>
            <PanelTitle>区域列表</PanelTitle>
            <PanelCount>{visibleAreas.length} 个区域</PanelCount>
          </PanelHeader>
          <TypeTabs>
            <TypeTab type="button" $active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>全部</TypeTab>
            <TypeTab type="button" $active={typeFilter === "danger"} onClick={() => setTypeFilter("danger")}>危险</TypeTab>
            <TypeTab type="button" $active={typeFilter === "restricted"} onClick={() => setTypeFilter("restricted")}>限制</TypeTab>
            <TypeTab type="button" $active={typeFilter === "prohibited"} onClick={() => setTypeFilter("prohibited")}>禁入</TypeTab>
          </TypeTabs>
          <AreaList>
            {visibleAreas.map((area) => (
              <AreaItem
                key={area.id}
                type="button"
                $active={area.id === selectedAreaId}
                onClick={() => handleAreaSelect(area.id)}
              >
                <AreaItemTop>
                  <AreaName>{area.name}</AreaName>
                  <AreaType $tone={AREA_TYPES[area.type].tone}>{AREA_TYPES[area.type].label}</AreaType>
                </AreaItemTop>
                <AreaMeta><MapPin size={12} />{area.code}<span>负责人：{area.manager}</span></AreaMeta>
                <AreaStats>
                  <span><UsersRound size={12} />{area.peopleCount} 人</span>
                  <span><Cpu size={12} />{area.deviceCount} 台</span>
                  <AreaAlarm $active={area.alertCount > 0}>{area.alertCount} 条告警</AreaAlarm>
                </AreaStats>
              </AreaItem>
            ))}
            {visibleAreas.length === 0 ? <EmptyState>未找到符合条件的区域</EmptyState> : null}
          </AreaList>
        </AreaPanel>

        <MapPanel>
          <MapHeader>
            <MapHeading>
              <strong>厂区电子围栏</strong>
              <span>{selectedArea?.name ?? "未选择区域"}</span>
            </MapHeading>
            <DrawTools>
              <ToolButton type="button" title="选择区域" $active={!drawMode} onClick={() => setDrawMode(null)}><MousePointer2 size={15} /></ToolButton>
              <ToolButton type="button" title="绘制多边形" $active={drawMode === "polygon"} onClick={() => startDrawing("polygon")}><Pentagon size={15} /></ToolButton>
              <ToolButton type="button" title="绘制圆形" $active={drawMode === "circle"} onClick={() => startDrawing("circle")}><Circle size={15} /></ToolButton>
              {drawMode === "polygon" ? (
                <ConfirmDrawButton
                  type="button"
                  disabled={draftPointCount < 3}
                  onClick={() => setConfirmDrawToken((current) => current + 1)}
                >
                  <Check size={14} />确认创建
                </ConfirmDrawButton>
              ) : null}
            </DrawTools>
          </MapHeader>
          <MapBody>
            <RiskControlMap
              areas={areas}
              selectedAreaId={selectedAreaId}
              onAreaSelect={handleAreaSelect}
              drawMode={drawMode}
              onDrawComplete={handleDrawComplete}
              confirmDrawToken={confirmDrawToken}
              onDraftPointCountChange={handleDraftPointCountChange}
            />
            <MapLegend>
              {Object.entries(AREA_TYPES).map(([key, item]) => (
                <span key={key}><i data-tone={item.tone} />{item.label}</span>
              ))}
            </MapLegend>
            <MonitorSummary>
              <span><UsersRound size={13} />区域内 {selectedArea?.peopleCount ?? 0} 人</span>
              <span><Cpu size={13} />关联 {selectedArea?.deviceCount ?? 0} 台设备</span>
            </MonitorSummary>
          </MapBody>
        </MapPanel>

        <ConfigPanel>
          <PanelHeader>
            <PanelTitle><SlidersHorizontal size={15} />规则配置</PanelTitle>
            <EnableControl>
              <span>{draft?.enabled ? "已启用" : "已停用"}</span>
              <Toggle checked={Boolean(draft?.enabled)} onChange={(value) => updateDraft("enabled", value)} label="启用区域" />
            </EnableControl>
          </PanelHeader>
          {draft ? (
            <ConfigBody>
              <SectionTitle>区域信息</SectionTitle>
              <FormGrid>
                <Field $wide>
                  <label>区域名称</label>
                  <input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} />
                </Field>
                <Field>
                  <label>区域类型</label>
                  <select value={draft.type} onChange={(event) => updateDraft("type", event.target.value)}>
                    {Object.entries(AREA_TYPES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                  </select>
                </Field>
                <Field>
                  <label>风险等级</label>
                  <select value={draft.riskLevel} onChange={(event) => updateDraft("riskLevel", event.target.value)}>
                    <option>低风险</option><option>中风险</option><option>高风险</option>
                  </select>
                </Field>
                <Field>
                  <label>区域负责人</label>
                  <select
                    value={draft.manager}
                    onChange={(event) => {
                      const manager = managerOptions.find((item) => item.name === event.target.value);
                      updateDraft("manager", event.target.value);
                      if (manager?.department) updateDraft("department", manager.department);
                    }}
                  >
                    {managerOptions.map((manager) => <option key={manager.id ?? manager.name}>{manager.name}</option>)}
                    {!managerOptions.some((manager) => manager.name === draft.manager) ? <option>{draft.manager}</option> : null}
                  </select>
                </Field>
                <Field>
                  <label>责任部门</label>
                  <input value={draft.department} onChange={(event) => updateDraft("department", event.target.value)} />
                </Field>
              </FormGrid>

              <SectionHeading>
                <SectionTitle>触发规则</SectionTitle>
                <RuleCount>{[draft.rules.crossBoundary, draft.rules.dwellEnabled, draft.rules.capacityEnabled].filter(Boolean).length} 条生效</RuleCount>
              </SectionHeading>
              <RuleList>
                <RuleRow>
                  <RuleIcon $tone="red"><ShieldAlert size={15} /></RuleIcon>
                  <RuleCopy><strong>越界触发</strong><span>人员进入或离开边界时告警</span></RuleCopy>
                  <Toggle checked={draft.rules.crossBoundary} onChange={(value) => updateRule("crossBoundary", value)} label="越界触发" />
                </RuleRow>
                <RuleRow>
                  <RuleIcon $tone="orange"><Timer size={15} /></RuleIcon>
                  <RuleCopy><strong>停留超时</strong><span>超过设定时长触发告警</span></RuleCopy>
                  <RuleInline><NumberInput type="number" min="1" value={draft.rules.dwellMinutes} onChange={(event) => updateRule("dwellMinutes", Number(event.target.value))} /><small>分钟</small><Toggle checked={draft.rules.dwellEnabled} onChange={(value) => updateRule("dwellEnabled", value)} label="停留超时" /></RuleInline>
                </RuleRow>
                <RuleRow>
                  <RuleIcon $tone="blue"><UsersRound size={15} /></RuleIcon>
                  <RuleCopy><strong>人数超限</strong><span>区域人数超过阈值时告警</span></RuleCopy>
                  <RuleInline><NumberInput type="number" min="0" value={draft.rules.maxPeople} onChange={(event) => updateRule("maxPeople", Number(event.target.value))} /><small>人</small><Toggle checked={draft.rules.capacityEnabled} onChange={(value) => updateRule("capacityEnabled", value)} label="人数超限" /></RuleInline>
                </RuleRow>
              </RuleList>

              <PriorityRow>
                <div><strong>规则优先级</strong><span>决定告警通知与升级顺序</span></div>
                <select value={draft.rules.priority} onChange={(event) => updateRule("priority", event.target.value)}>
                  <option>低</option><option>中</option><option>高</option><option>紧急</option>
                </select>
              </PriorityRow>

              <OwnerCard>
                <OwnerIcon><UserRound size={18} /></OwnerIcon>
                <div><span>当前责任人</span><strong>{draft.manager}</strong><small>{draft.department} · 关联 {draft.deviceCount} 台设备</small></div>
                <Check size={16} />
              </OwnerCard>
            </ConfigBody>
          ) : null}
          <ConfigFooter>
            <DeleteButton type="button" onClick={() => setDeleteDialogOpen(true)} disabled={!draft || isDeleting}><Trash2 size={14} />删除区域</DeleteButton>
            <ResetButton type="button" onClick={() => setDraft(selectedArea)} disabled={!draft}><RotateCcw size={14} />重置</ResetButton>
            <SaveButton type="button" onClick={saveDraft} disabled={!draft || isSaving}><Save size={14} />{isSaving ? "保存中..." : "保存配置"}</SaveButton>
          </ConfigFooter>
          {savedMessage ? <SavedToast><Check size={14} />{savedMessage}</SavedToast> : null}
        </ConfigPanel>
      </Workspace>
      {deleteDialogOpen && draft ? (
        <DialogBackdrop role="presentation" onMouseDown={() => !isDeleting && setDeleteDialogOpen(false)}>
          <DeleteDialog role="dialog" aria-modal="true" aria-labelledby="delete-area-title" onMouseDown={(event) => event.stopPropagation()}>
            <DialogIcon><Trash2 size={20} /></DialogIcon>
            <DialogCopy>
              <h2 id="delete-area-title">删除“{draft.name}”</h2>
              <p>删除后，当前人员和设备将解除该区域关联；历史告警记录仍会保留。</p>
            </DialogCopy>
            <DialogActions>
              <DialogCancel type="button" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>取消</DialogCancel>
              <DialogConfirm type="button" onClick={deleteDraft} disabled={isDeleting}>{isDeleting ? "删除中..." : "确认删除"}</DialogConfirm>
            </DialogActions>
          </DeleteDialog>
        </DialogBackdrop>
      ) : null}
    </Wrapper>
  );
}

const Wrapper = styled.div`
  width: 100%;
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: 52px 82px minmax(0, 1fr);
  gap: 10px;
  overflow: hidden;
  padding: 12px 14px 14px;
  background: hsl(216 26% 97%);
`;

const PageHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
`;

const PageHeading = styled.div`min-width: 0;`;
const PageTitle = styled.h1`color: ${COLORS.gray10}; font-size: ${FONT_SIZES.peoplePageTitle}; font-weight: 700;`;
const PageSubtitle = styled.p`margin-top: 4px; color: hsl(218 10% 48%); font-size: ${FONT_SIZES.peoplePageSubtitle};`;
const HeaderActions = styled.div`display: flex; align-items: center; gap: 8px;`;

const SearchBox = styled.label`
  width: 270px;
  height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid hsl(220 13% 84%);
  border-radius: 6px;
  padding: 0 10px;
  color: hsl(218 10% 48%);
  background: white;
  &:focus-within { border-color: hsl(217 91% 62%); box-shadow: 0 0 0 2px hsl(214 100% 94%); }
  input { min-width: 0; flex: 1; border: 0; outline: 0; font-size: 0.75rem; }
`;

const TypeSelect = styled.select`
  height: 34px;
  border: 1px solid hsl(220 13% 84%);
  border-radius: 6px;
  padding: 0 28px 0 10px;
  color: hsl(218 15% 28%);
  background: white;
  font-size: 0.75rem;
`;

const PrimaryButton = styled.button`
  height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: 6px;
  padding: 0 14px;
  color: white;
  background: ${COLORS.blue};
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: hsl(220 90% 44%); }
`;

const MetricGrid = styled.div`display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;`;
const Metric = styled.article`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid hsl(220 13% 88%);
  border-radius: 7px;
  padding: 10px 14px;
  background: white;
`;
const MetricIcon = styled.div`
  width: 40px; height: 40px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 50%;
  color: ${(p) => ({ blue: "#1677ff", red: "#ef4444", green: "#10b981", orange: "#f59e0b" }[p.$tone])};
  background: ${(p) => ({ blue: "#eaf3ff", red: "#fff0f0", green: "#eafaf4", orange: "#fff6e8" }[p.$tone])};
`;
const MetricCopy = styled.div`min-width: 0;`;
const MetricLabel = styled.p`color: hsl(218 10% 43%); font-size: 0.75rem;`;
const MetricValue = styled.p`margin-top: 2px; color: hsl(218 20% 17%); font: 700 1.375rem/1 var(--font-data); span { margin-left: 4px; font-size: 0.6875rem; font-weight: 500; }`;

const Workspace = styled.div`
  min-height: 0;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 370px;
  gap: 10px;
`;

const BasePanel = styled.section`
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid hsl(220 13% 86%);
  border-radius: 7px;
  background: white;
`;
const AreaPanel = styled(BasePanel)`display: grid; grid-template-rows: 46px 42px minmax(0, 1fr);`;
const ConfigPanel = styled(BasePanel)`display: grid; grid-template-rows: 46px minmax(0, 1fr) 52px;`;
const MapPanel = styled(BasePanel)`display: grid; grid-template-rows: 46px minmax(0, 1fr);`;

const PanelHeader = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid hsl(220 13% 90%);
  padding: 0 12px;
`;
const PanelTitle = styled.h2`display: flex; align-items: center; gap: 6px; color: hsl(218 20% 18%); font-size: 0.8125rem; font-weight: 700;`;
const PanelCount = styled.span`color: hsl(218 10% 48%); font-size: 0.6875rem;`;

const TypeTabs = styled.div`display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 7px 10px;`;
const TypeTab = styled.button`
  height: 28px; border: 0; border-radius: 4px; color: ${(p) => p.$active ? COLORS.blue : "hsl(218 10% 42%)"};
  background: ${(p) => p.$active ? "hsl(214 100% 96%)" : "transparent"}; font-size: 0.6875rem; cursor: pointer;
`;
const AreaList = styled.div`min-height: 0; overflow-y: auto; padding: 2px 8px 10px;`;
const AreaItem = styled.button`
  width: 100%; display: block; border: 1px solid ${(p) => p.$active ? "hsl(217 91% 66%)" : "transparent"};
  border-radius: 6px; padding: 10px; color: inherit; background: ${(p) => p.$active ? "hsl(214 100% 97%)" : "white"};
  text-align: left; cursor: pointer;
  & + & { margin-top: 5px; }
  &:hover { background: hsl(216 33% 97%); }
`;
const AreaItemTop = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 8px;`;
const AreaName = styled.strong`min-width: 0; overflow: hidden; color: hsl(218 20% 18%); font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap;`;
const AreaType = styled.span`
  flex: 0 0 auto; border-radius: 3px; padding: 2px 5px; font-size: 0.625rem;
  color: ${(p) => ({ red: "#dc2626", darkRed: "#991b1b", orange: "#d97706", green: "#15803d" }[p.$tone])};
  background: ${(p) => ({ red: "#fef2f2", darkRed: "#fee2e2", orange: "#fff7ed", green: "#f0fdf4" }[p.$tone])};
`;
const AreaMeta = styled.div`margin-top: 7px; display: flex; align-items: center; gap: 4px; color: hsl(218 10% 48%); font-size: 0.625rem; span { margin-left: auto; }`;
const AreaStats = styled.div`margin-top: 8px; display: flex; align-items: center; gap: 10px; color: hsl(218 12% 36%); font-size: 0.625rem; span { display: inline-flex; align-items: center; gap: 3px; }`;
const AreaAlarm = styled.em`margin-left: auto; color: ${(p) => p.$active ? "#dc2626" : "hsl(218 10% 52%)"}; font-style: normal;`;
const EmptyState = styled.div`padding: 30px 12px; color: hsl(218 10% 52%); font-size: 0.75rem; text-align: center;`;

const MapHeader = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid hsl(220 13% 90%); padding: 0 10px 0 12px;`;
const MapHeading = styled.div`min-width: 0; display: flex; align-items: center; gap: 10px; strong { font-size: 0.8125rem; } span { overflow: hidden; color: hsl(218 10% 48%); font-size: 0.6875rem; text-overflow: ellipsis; white-space: nowrap; }`;
const DrawTools = styled.div`display: flex; align-items: center; gap: 4px;`;
const ToolButton = styled.button`
  width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid ${(p) => p.$active ? "hsl(217 91% 64%)" : "hsl(220 13% 85%)"};
  border-radius: 5px; color: ${(p) => p.$active ? COLORS.blue : "hsl(218 12% 38%)"}; background: ${(p) => p.$active ? "hsl(214 100% 96%)" : "white"}; cursor: pointer;
`;
const ConfirmDrawButton = styled.button`
  height: 30px; display: inline-flex; align-items: center; gap: 5px; border: 1px solid ${COLORS.blue}; border-radius: 5px;
  padding: 0 10px; color: white; background: ${COLORS.blue}; font-size: 0.6875rem; cursor: pointer;
  &:disabled { border-color: hsl(220 10% 78%); color: hsl(218 10% 52%); background: hsl(220 13% 93%); cursor: not-allowed; }
`;
const MapBody = styled.div`position: relative; min-height: 0; overflow: hidden;`;
const MapLegend = styled.div`
  position: absolute; left: 12px; top: 12px; z-index: 2; display: flex; gap: 10px; border: 1px solid hsl(220 13% 86%); border-radius: 5px;
  padding: 7px 9px; background: hsl(0 0% 100% / 0.94); box-shadow: 0 3px 12px hsl(218 30% 20% / 0.12); font-size: 0.625rem;
  span { display: inline-flex; align-items: center; gap: 4px; } i { width: 7px; height: 7px; border-radius: 50%; }
  i[data-tone="red"] { background: #ef4444; } i[data-tone="darkRed"] { background: #991b1b; } i[data-tone="orange"] { background: #f59e0b; } i[data-tone="green"] { background: #22c55e; }
`;
const MonitorSummary = styled.div`
  position: absolute; left: 12px; bottom: 28px; z-index: 2; display: flex; gap: 12px; border: 1px solid hsl(220 13% 86%); border-radius: 5px;
  padding: 8px 10px; background: hsl(0 0% 100% / 0.94); box-shadow: 0 3px 12px hsl(218 30% 20% / 0.12); color: hsl(218 12% 32%); font-size: 0.6875rem;
  span { display: inline-flex; align-items: center; gap: 4px; }
`;

const EnableControl = styled.div`display: flex; align-items: center; gap: 7px; color: hsl(218 10% 42%); font-size: 0.6875rem;`;
const ToggleButton = styled.button`
  position: relative; width: 32px; height: 18px; flex: 0 0 auto; border: 0; border-radius: 10px;
  background: ${(p) => p.$checked ? COLORS.blue : "hsl(220 10% 76%)"}; cursor: pointer; transition: background 120ms ease;
`;
const ToggleThumb = styled.span`
  position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: white;
  box-shadow: 0 1px 3px hsl(218 30% 20% / 0.24); transform: translateX(${(p) => p.$checked ? "14px" : "0"}); transition: transform 120ms ease;
`;
const ConfigBody = styled.div`min-height: 0; overflow-y: auto; padding: 12px;`;
const SectionTitle = styled.h3`color: hsl(218 18% 22%); font-size: 0.75rem; font-weight: 700;`;
const SectionHeading = styled.div`margin-top: 16px; display: flex; align-items: center; justify-content: space-between;`;
const RuleCount = styled.span`color: hsl(218 10% 48%); font-size: 0.625rem;`;
const FormGrid = styled.div`margin-top: 9px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px;`;
const Field = styled.label`
  min-width: 0; grid-column: ${(p) => p.$wide ? "1 / -1" : "auto"}; display: grid; gap: 5px;
  label, & > span { color: hsl(218 10% 46%); font-size: 0.625rem; }
  input, select { width: 100%; height: 30px; border: 1px solid hsl(220 13% 84%); border-radius: 5px; padding: 0 8px; outline: 0; color: hsl(218 15% 25%); background: white; font-size: 0.6875rem; }
  input:focus, select:focus { border-color: hsl(217 91% 64%); }
`;
const RuleList = styled.div`margin-top: 8px; border: 1px solid hsl(220 13% 89%); border-radius: 6px;`;
const RuleRow = styled.div`
  min-height: 58px; display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 8px;
  & + & { border-top: 1px solid hsl(220 13% 91%); }
`;
const RuleIcon = styled.div`width: 30px; height: 30px; display: grid; place-items: center; border-radius: 5px; color: ${(p) => ({ red: "#dc2626", orange: "#d97706", blue: "#2563eb" }[p.$tone])}; background: ${(p) => ({ red: "#fef2f2", orange: "#fff7ed", blue: "#eff6ff" }[p.$tone])};`;
const RuleCopy = styled.div`min-width: 0; display: grid; gap: 3px; strong { font-size: 0.6875rem; } span { overflow: hidden; color: hsl(218 10% 48%); font-size: 0.59375rem; text-overflow: ellipsis; white-space: nowrap; }`;
const RuleInline = styled.div`display: flex; align-items: center; gap: 4px; small { color: hsl(218 10% 48%); font-size: 0.59375rem; }`;
const NumberInput = styled.input`width: 43px; height: 25px; border: 1px solid hsl(220 13% 84%); border-radius: 4px; padding: 0 3px; font: 0.625rem var(--font-data); text-align: center;`;
const PriorityRow = styled.div`
  margin-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid hsl(220 13% 89%); border-radius: 6px; padding: 9px;
  div { min-width: 0; display: grid; gap: 3px; } strong { font-size: 0.6875rem; } span { color: hsl(218 10% 48%); font-size: 0.59375rem; }
  select { width: 76px; height: 28px; border: 1px solid hsl(220 13% 84%); border-radius: 5px; padding: 0 7px; background: white; font-size: 0.6875rem; }
`;
const OwnerCard = styled.div`
  margin-top: 10px; display: grid; grid-template-columns: 34px minmax(0, 1fr) 18px; align-items: center; gap: 9px; border-radius: 6px; padding: 9px; color: hsl(218 48% 30%); background: hsl(214 100% 97%);
  div:nth-child(2) { min-width: 0; display: grid; grid-template-columns: auto 1fr; gap: 2px 7px; } span { color: hsl(218 10% 46%); font-size: 0.59375rem; } strong { font-size: 0.6875rem; } small { grid-column: 1 / -1; color: hsl(218 10% 46%); font-size: 0.59375rem; }
`;
const OwnerIcon = styled.div`width: 34px; height: 34px; display: grid !important; grid-template-columns: 1fr !important; place-items: center; border-radius: 50%; color: ${COLORS.blue}; background: white;`;
const ConfigFooter = styled.div`display: flex; align-items: center; justify-content: flex-end; gap: 8px; border-top: 1px solid hsl(220 13% 90%); padding: 0 12px;`;
const FooterButton = styled.button`height: 30px; display: inline-flex; align-items: center; gap: 5px; border-radius: 5px; padding: 0 11px; font-size: 0.6875rem; cursor: pointer;`;
const ResetButton = styled(FooterButton)`border: 1px solid hsl(220 13% 84%); color: hsl(218 12% 32%); background: white;`;
const SaveButton = styled(FooterButton)`border: 1px solid ${COLORS.blue}; color: white; background: ${COLORS.blue};`;
const DeleteButton = styled(FooterButton)`margin-right: auto; border: 1px solid hsl(0 72% 88%); color: #dc2626; background: #fff7f7;`;
const SavedToast = styled.div`position: absolute; right: 12px; bottom: 58px; display: flex; align-items: center; gap: 5px; border-radius: 5px; padding: 7px 10px; color: #047857; background: #ecfdf5; box-shadow: 0 3px 12px hsl(218 30% 20% / 0.14); font-size: 0.6875rem;`;
const DialogBackdrop = styled.div`position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; background: hsl(218 30% 12% / 0.42);`;
const DeleteDialog = styled.div`width: 390px; display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 12px; border-radius: 8px; padding: 20px; background: white; box-shadow: 0 24px 70px hsl(218 35% 10% / 0.3);`;
const DialogIcon = styled.div`width: 42px; height: 42px; display: grid; place-items: center; border-radius: 7px; color: #dc2626; background: #fef2f2;`;
const DialogCopy = styled.div`min-width: 0; h2 { color: hsl(218 20% 18%); font-size: 0.9375rem; } p { margin-top: 8px; color: hsl(218 10% 45%); font-size: 0.75rem; line-height: 1.6; }`;
const DialogActions = styled.div`grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;`;
const DialogCancel = styled(FooterButton)`border: 1px solid hsl(220 13% 84%); color: hsl(218 12% 32%); background: white;`;
const DialogConfirm = styled(FooterButton)`border: 1px solid #dc2626; color: white; background: #dc2626;`;

export default RiskControl;
