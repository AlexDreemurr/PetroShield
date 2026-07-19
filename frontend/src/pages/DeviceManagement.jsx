import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import styled from "styled-components";
import {
  Activity,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  DoorOpen,
  Droplets,
  EllipsisVertical,
  Flame,
  Gauge,
  Pencil,
  Radio,
  RotateCcw,
  Search,
  Thermometer,
  Trash2,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { API_BASE_URL } from "../config/api";
import { BUSINESS_PAGE_LAYOUT, COLORS, FONT_SIZES } from "../constants/STYLES";
import { getCachedJson, loadCachedJson, PAGE_DATA_URLS } from "../services/pageDataCache";

const DEVICE_TABS = [
  { key: "all", label: "全部设备" },
  { key: "online", label: "在线" },
  { key: "offline", label: "离线" },
  { key: "alarm", label: "告警" },
  { key: "fault", label: "异常" },
];

const DEFAULT_PAGE_SIZE = 9;

const statusLabels = {
  online: "在线",
  offline: "离线",
  alarm: "告警",
  fault: "异常",
  maintenance: "维护",
};

const statusTone = {
  online: "green",
  offline: "red",
  alarm: "orange",
  fault: "orange",
  maintenance: "orange",
};

function formatDateTime(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date
    .toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replaceAll("/", "-");
}

function normalizeDeviceStatus(status) {
  if (status === "online") {
    return "online";
  }

  if (status === "offline") {
    return "offline";
  }

  if (status === "fault") {
    return "fault";
  }

  if (status === "alarm") {
    return "alarm";
  }

  if (status === "maintenance") {
    return "maintenance";
  }

  return "offline";
}

function getLocationText(item) {
  if (item.locationText) {
    return item.locationText;
  }

  if (item.location?.zone) {
    return item.location.zone;
  }

  if (item.area_name) {
    return item.area_name;
  }

  if (item.location?.view) {
    return item.location.view;
  }

  return "--";
}

function getIconType(type) {
  if (type?.includes("温")) {
    return "temperature";
  }
  if (type?.includes("烟")) {
    return "smoke";
  }
  if (type?.includes("门")) {
    return "door";
  }
  if (type?.includes("水")) {
    return "water";
  }
  if (type?.includes("电") || type?.includes("仪表")) {
    return "meter";
  }
  if (type?.includes("气")) {
    return "gas";
  }
  if (type?.includes("摄像")) {
    return "camera";
  }
  return "pir";
}

function normalizeApiDevice(item) {
  const realtime = item.realtime ?? {};
  const status = normalizeDeviceStatus(realtime.status);
  const locationText = getLocationText(item);

  return {
    id: item.id,
    name: item.name,
    type: item.type,
    status,
    signal:
      realtime.signal_strength == null
        ? null
        : -Math.round(100 - realtime.signal_strength / 2),
    battery: realtime.battery == null ? null : Math.round(realtime.battery),
    location: locationText,
    heartbeat: formatDateTime(realtime.last_heartbeat),
    iconType: getIconType(item.type),
    iconTone: item.type?.includes("气") ? "orange" : "blue",
    health: Math.round(realtime.health_score ?? 80),
    organization: item.area_name ?? "石安盾科技园区",
    installTime: formatDateTime(item.install_date),
    firmware: item.model ?? "v2.3.7",
    hardware: item.serial_number ?? "v1.1",
    protocol: item.type === "摄像头" ? "TCP/IP" : "LoRaWAN",
    powerMode: realtime.battery == null ? "外部供电" : null,
    recentAlarms: item.recent_alarms,
    maintenanceRows: item.maintenance?.status
      ? [
          {
            type: item.maintenance.status,
            content: item.maintenance.remark ?? "--",
            person: item.maintenance.maintainer_name ?? "--",
            time: formatDateTime(
              item.maintenance.last_repair_time ??
                item.maintenance.last_inspect_time
            ),
          },
        ]
      : [],
    raw: item,
  };
}

function filterDevices(devices, filters, activeTab, keyword) {
  return devices.filter((device) => {
    const matchesTab = activeTab === "all" || device.status === activeTab;
    const matchesType =
      filters.type === "all" || device.type.includes(filters.type);
    const matchesStatus =
      filters.status === "all" || device.status === filters.status;
    const matchesLocation =
      filters.location === "all" || device.location.includes(filters.location);
    const normalizedKeyword = keyword.trim().toLowerCase();
    const matchesKeyword =
      !normalizedKeyword ||
      [device.name, device.id, device.type, device.location]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedKeyword)
        );

    return (
      matchesTab &&
      matchesType &&
      matchesStatus &&
      matchesLocation &&
      matchesKeyword
    );
  });
}

function DeviceGlyph({ type }) {
  const iconMap = {
    temperature: Thermometer,
    smoke: Waves,
    door: DoorOpen,
    water: Droplets,
    meter: Gauge,
    pir: Radio,
    gas: Flame,
    camera: Camera,
  };
  const Component = iconMap[type] ?? Activity;

  return <Component size={31} strokeWidth={2.2} />;
}

function SignalBars({ value }) {
  const bars =
    value == null ? 0 : Math.max(1, Math.min(5, Math.round((100 + value) / 8)));

  return (
    <SignalWrap aria-label={`信号 ${value ?? "--"} dBm`}>
      {Array.from({ length: 5 }, (_, index) => (
        <SignalBar key={index} $active={index < bars} $height={6 + index * 3} />
      ))}
    </SignalWrap>
  );
}

function BatteryIndicator({ value, powerMode }) {
  if (powerMode) {
    return <PowerText>{powerMode}</PowerText>;
  }

  const isLow = Number(value) < 25;

  return (
    <BatteryWrap $low={isLow}>
      <BatteryShell>
        <BatteryFill $value={Math.max(0, Math.min(100, Number(value) || 0))} />
      </BatteryShell>
      <span>{value ?? "--"}%</span>
    </BatteryWrap>
  );
}

function DeviceCard({ device, isSelected, onSelect }) {
  const tone = statusTone[device.status] ?? "gray";

  return (
    <DeviceCardButton type="button" $selected={isSelected} onClick={onSelect}>
      <DeviceCardTop>
        <DeviceIcon $tone={device.iconTone}>
          <DeviceGlyph type={device.iconType} />
        </DeviceIcon>
        <DeviceIdentity>
          <DeviceName>{device.name}</DeviceName>
          <DeviceMeta>ID：{device.id}</DeviceMeta>
          <DeviceMeta>类型：{device.type}</DeviceMeta>
        </DeviceIdentity>
        <MoreButton
          type="button"
          aria-label="更多操作"
          onClick={(event) => event.stopPropagation()}
        >
          <EllipsisVertical size={17} />
        </MoreButton>
      </DeviceCardTop>

      <DeviceFacts>
        <DeviceFact>
          <span>状态：</span>
          <StatusDot $tone={tone} />
          <StatusText $tone={tone}>{statusLabels[device.status]}</StatusText>
        </DeviceFact>
        <DeviceFact>
          <span>信号：</span>
          <SignalBars value={device.signal} />
          <ValueText>
            {device.signal == null ? "--" : `${device.signal} dBm`}
          </ValueText>
        </DeviceFact>
        <DeviceFact>
          <span>电量：</span>
          <BatteryIndicator
            value={device.battery}
            powerMode={device.powerMode}
          />
        </DeviceFact>
        <DeviceFact>
          <span>位置：</span>
          <ValueText>{device.location}</ValueText>
        </DeviceFact>
        <DeviceFact>
          <span>心跳：</span>
          <ValueText>{device.heartbeat}</ValueText>
        </DeviceFact>
      </DeviceFacts>
    </DeviceCardButton>
  );
}

function HealthRing({ value }) {
  const circumference = 2 * Math.PI * 33;
  const offset = circumference - (value / 100) * circumference;

  return (
    <HealthRingWrap>
      <svg viewBox="0 0 82 82" role="img" aria-label={`设备健康度 ${value}`}>
        <circle cx="41" cy="41" r="33" />
        <circle
          cx="41"
          cy="41"
          r="33"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <text x="41" y="37">
          {value}
        </text>
        <text x="41" y="56">
          健康
        </text>
      </svg>
    </HealthRingWrap>
  );
}

function DetailDrawer({ device, onClose, onEdit, onDelete, isMutating }) {
  const [activeTab, setActiveTab] = useState("detail");
  const [copiedField, setCopiedField] = useState(null);
  const healthScores = device.healthScores ?? [
    Math.min(99, device.health + 2),
    Math.max(70, device.health - 1),
    Math.max(70, device.health - 2),
    device.health,
  ];
  const alarms = device.recentAlarms ?? [];
  const maintenanceRows = device.maintenanceRows ?? [];

  async function handleCopy(value, field) {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1200);
    } catch {
      setCopiedField(null);
    }
  }

  return (
    <Drawer>
      <DrawerHeader>
        <DrawerTitle>
          <DrawerTitleText>{device.name}</DrawerTitleText>
          <CopyButton
            type="button"
            aria-label="复制设备名称"
            title={copiedField === "name" ? "已复制" : "复制设备名称"}
            onClick={() => handleCopy(device.name, "name")}
          >
            <Copy size={13} />
          </CopyButton>
          <StatusBadge $tone={statusTone[device.status]}>
            {statusLabels[device.status]}
          </StatusBadge>
        </DrawerTitle>
        <CloseDrawerButton
          type="button"
          aria-label="关闭详情"
          onClick={onClose}
        >
          <X size={18} />
        </CloseDrawerButton>
      </DrawerHeader>

      <DrawerTabs>
        <DrawerTab
          type="button"
          $active={activeTab === "detail"}
          onClick={() => setActiveTab("detail")}
        >
          设备详情
        </DrawerTab>
        <DrawerTab
          type="button"
          $active={activeTab === "runtime"}
          onClick={() => setActiveTab("runtime")}
        >
          运行数据
        </DrawerTab>
        <DrawerTab
          type="button"
          $active={activeTab === "alarms"}
          onClick={() => setActiveTab("alarms")}
        >
          告警记录
        </DrawerTab>
        <DrawerTab
          type="button"
          $active={activeTab === "maintenance"}
          onClick={() => setActiveTab("maintenance")}
        >
          维护记录
        </DrawerTab>
      </DrawerTabs>

      <DrawerBody>
        {activeTab === "detail" ? (
          <>
            <DeviceOverview>
              <LargeDeviceIcon $tone={device.iconTone}>
                <DeviceGlyph type={device.iconType} />
              </LargeDeviceIcon>
              <DeviceInfoGrid>
                <InfoLabel>设备ID</InfoLabel>
                <InfoValue>
                  {device.id}
                  <CopyButton
                    type="button"
                    aria-label="复制设备ID"
                    title={copiedField === "id" ? "已复制" : "复制设备ID"}
                    onClick={() => handleCopy(device.id, "id")}
                  >
                    <Copy size={13} />
                  </CopyButton>
                </InfoValue>
                <InfoLabel>设备类型</InfoLabel>
                <InfoValue>{device.type}</InfoValue>
                <InfoLabel>所属组织</InfoLabel>
                <InfoValue>{device.organization ?? "石安盾科技园区"}</InfoValue>
                <InfoLabel>安装位置</InfoLabel>
                <InfoValue>{device.location}</InfoValue>
                <InfoLabel>安装时间</InfoLabel>
                <InfoValue>{device.installTime ?? "--"}</InfoValue>
                <InfoLabel>设备状态</InfoLabel>
                <InfoValue>
                  <StatusDot $tone={statusTone[device.status]} />
                  <StatusText $tone={statusTone[device.status]}>
                    {statusLabels[device.status]}
                  </StatusText>
                </InfoValue>
                <InfoLabel>信号强度</InfoLabel>
                <InfoValue>
                  <SignalBars value={device.signal} />
                  {device.signal == null ? "--" : `${device.signal} dBm`}
                </InfoValue>
                <InfoLabel>电量</InfoLabel>
                <InfoValue>
                  <BatteryIndicator
                    value={device.battery}
                    powerMode={device.powerMode}
                  />
                </InfoValue>
                <InfoLabel>固件版本</InfoLabel>
                <InfoValue>{device.firmware ?? "--"}</InfoValue>
                <InfoLabel>硬件版本</InfoLabel>
                <InfoValue>{device.hardware ?? "--"}</InfoValue>
                <InfoLabel>通信协议</InfoLabel>
                <InfoValue>{device.protocol ?? "--"}</InfoValue>
                <InfoLabel>最后心跳</InfoLabel>
                <InfoValue>{device.heartbeat}</InfoValue>
              </DeviceInfoGrid>
              <HealthBlock>
                <SmallLabel>设备健康度</SmallLabel>
                <HealthRing value={device.health} />
              </HealthBlock>
            </DeviceOverview>

            <Divider />

            <SectionHeader>
              <SectionTitle>健康评估</SectionTitle>
            </SectionHeader>
            <ScoreGrid>
              {["稳定性", "数据完整性", "响应时效", "总体评分"].map(
                (label, index) => (
                  <ScoreCard key={label}>
                    <ScoreLabel>{label}</ScoreLabel>
                    <ScoreValue>{healthScores[index]}</ScoreValue>
                    <ScoreState>优</ScoreState>
                  </ScoreCard>
                )
              )}
            </ScoreGrid>

            <SectionHeader>
              <SectionTitle>最近告警</SectionTitle>
              <ViewAllButton type="button">
                查看全部 <ChevronRight size={12} />
              </ViewAllButton>
            </SectionHeader>
            {alarms.length > 0 ? (
              <AlarmList>
                {alarms.map((alarm) => (
                  <AlarmItem key={`${alarm.type}-${alarm.time}`}>
                    <AlarmIcon $tone={alarm.tone ?? "orange"}>
                      <Zap size={13} />
                    </AlarmIcon>
                    <AlarmName>{alarm.type}</AlarmName>
                    <AlarmTime>{formatDateTime(alarm.time)}</AlarmTime>
                    <RecoveredBadge>{alarm.status}</RecoveredBadge>
                  </AlarmItem>
                ))}
              </AlarmList>
            ) : (
              <DrawerEmpty>暂无告警记录</DrawerEmpty>
            )}

            <SectionHeader>
              <SectionTitle>维护记录</SectionTitle>
              <ViewAllButton type="button">
                查看全部 <ChevronRight size={12} />
              </ViewAllButton>
            </SectionHeader>
            <MaintenanceTable>
              <thead>
                <tr>
                  <th>维护类型</th>
                  <th>维护内容</th>
                  <th>维护人</th>
                  <th>维护时间</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceRows.length > 0 ? (
                  maintenanceRows.map((row) => (
                    <tr key={`${row.type}-${row.time}`}>
                      <td>{row.type}</td>
                      <td>{row.content}</td>
                      <td>{row.person}</td>
                      <td>{row.time}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <EmptyTableCell colSpan="4">暂无维护记录</EmptyTableCell>
                  </tr>
                )}
              </tbody>
            </MaintenanceTable>
          </>
        ) : (
          <TabFailureState>
            {activeTab === "runtime"
              ? "运行数据加载失败"
              : activeTab === "alarms"
              ? "告警记录加载失败"
              : "维护记录加载失败"}
          </TabFailureState>
        )}
      </DrawerBody>

      <DrawerFooter>
        <SecondaryAction type="button" onClick={onEdit} disabled={isMutating}>
          <Pencil size={15} />
          编辑设备
        </SecondaryAction>
        <SecondaryAction type="button">
          <RotateCcw size={15} />
          重启设备
        </SecondaryAction>
        <DangerAction type="button" onClick={onDelete} disabled={isMutating}>
          <Trash2 size={15} />
          删除设备
        </DangerAction>
      </DrawerFooter>
    </Drawer>
  );
}

function DeviceEditDialog({ device, areas, busy, error, onClose, onSubmit }) {
  const raw = device.raw ?? {};
  const [form, setForm] = useState({
    name: raw.name ?? device.name,
    type: raw.type ?? device.type,
    category: raw.category ?? "感知设备",
    model: raw.model ?? "",
    manufacturer: raw.manufacturer ?? "",
    serial_number: raw.serial_number ?? "",
    install_date: raw.install_date?.slice(0, 10) ?? "",
    region_id: raw.region_id ?? "",
    location_zone: raw.location?.zone ?? raw.area_name ?? "",
    realtime_status: raw.realtime?.status ?? device.status,
  });

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.type.trim() || !form.category.trim()) return;
    onSubmit({
      name: form.name.trim(),
      type: form.type.trim(),
      category: form.category.trim(),
      model: form.model.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
      serial_number: form.serial_number.trim() || null,
      install_date: form.install_date
        ? new Date(`${form.install_date}T00:00:00+08:00`).toISOString()
        : null,
      region_id: form.region_id || null,
      location: {
        ...(raw.location ?? {}),
        zone: form.location_zone.trim() || null,
      },
      realtime_status: form.realtime_status,
    });
  };

  return (
    <ModalBackdrop role="presentation">
      <EditDialog role="dialog" aria-modal="true" aria-label="编辑设备">
        <DialogHeader>
          <div>
            <strong>编辑设备</strong>
            <span>{device.id}</span>
          </div>
          <CloseDrawerButton type="button" aria-label="关闭编辑设备" onClick={onClose}>
            <X size={18} />
          </CloseDrawerButton>
        </DialogHeader>
        <DeviceForm onSubmit={submit}>
          <FormGrid>
            <FormField>
              <span>设备名称</span>
              <input value={form.name} onChange={(event) => updateField("name", event.target.value)} />
            </FormField>
            <FormField>
              <span>设备类型</span>
              <input value={form.type} onChange={(event) => updateField("type", event.target.value)} />
            </FormField>
            <FormField>
              <span>设备分类</span>
              <select value={form.category} onChange={(event) => updateField("category", event.target.value)}>
                <option value="感知设备">感知设备</option>
                <option value="生产设备">生产设备</option>
                <option value="安防设备">安防设备</option>
                <option value="定位设备">定位设备</option>
              </select>
            </FormField>
            <FormField>
              <span>运行状态</span>
              <select value={form.realtime_status} onChange={(event) => updateField("realtime_status", event.target.value)}>
                <option value="online">在线</option>
                <option value="offline">离线</option>
                <option value="alarm">告警</option>
                <option value="fault">异常</option>
                <option value="maintenance">维护</option>
              </select>
            </FormField>
            <FormField>
              <span>设备型号</span>
              <input value={form.model} onChange={(event) => updateField("model", event.target.value)} />
            </FormField>
            <FormField>
              <span>生产厂商</span>
              <input value={form.manufacturer} onChange={(event) => updateField("manufacturer", event.target.value)} />
            </FormField>
            <FormField>
              <span>序列号</span>
              <input value={form.serial_number} onChange={(event) => updateField("serial_number", event.target.value)} />
            </FormField>
            <FormField>
              <span>安装日期</span>
              <input type="date" value={form.install_date} onChange={(event) => updateField("install_date", event.target.value)} />
            </FormField>
            <FormField>
              <span>所属区域</span>
              <select value={form.region_id} onChange={(event) => updateField("region_id", event.target.value)}>
                <option value="">未关联区域</option>
                {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select>
            </FormField>
            <FormField>
              <span>安装位置</span>
              <input value={form.location_zone} onChange={(event) => updateField("location_zone", event.target.value)} />
            </FormField>
          </FormGrid>
          {error && <DialogError>{error}</DialogError>}
          <DialogActions>
            <SecondaryAction type="button" onClick={onClose} disabled={busy}>取消</SecondaryAction>
            <PrimaryAction type="submit" disabled={busy}>{busy ? "保存中" : "保存修改"}</PrimaryAction>
          </DialogActions>
        </DeviceForm>
      </EditDialog>
    </ModalBackdrop>
  );
}

function DeviceDeleteDialog({ device, busy, error, onClose, onConfirm }) {
  return (
    <ModalBackdrop role="presentation">
      <DeleteDialog role="alertdialog" aria-modal="true" aria-label="删除设备">
        <DeleteIcon><Trash2 size={20} /></DeleteIcon>
        <strong>删除设备“{device.name}”？</strong>
        <p>设备实时状态、维护记录和合规记录将一并删除，人员绑定与历史告警会解除该设备关联。</p>
        {error && <DialogError>{error}</DialogError>}
        <DialogActions>
          <SecondaryAction type="button" onClick={onClose} disabled={busy}>取消</SecondaryAction>
          <ConfirmDeleteButton type="button" onClick={onConfirm} disabled={busy}>
            {busy ? "删除中" : "确认删除"}
          </ConfirmDeleteButton>
        </DialogActions>
      </DeleteDialog>
    </ModalBackdrop>
  );
}

function DeviceManagement() {
  const [searchParams] = useSearchParams();
  const initialPayload = getCachedJson(PAGE_DATA_URLS.devices);
  const initialAreaPayload = getCachedJson(PAGE_DATA_URLS.areas);
  const [devices, setDevices] = useState(() =>
    (initialPayload?.items ?? []).map(normalizeApiDevice)
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState(
    () => searchParams.get("device_id") || null
  );
  const [editDevice, setEditDevice] = useState(null);
  const [deleteDevice, setDeleteDevice] = useState(null);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [areaOptions, setAreaOptions] = useState(
    () => initialAreaPayload?.items ?? []
  );
  const [activeTab, setActiveTab] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSizeInput, setPageSizeInput] = useState(String(DEFAULT_PAGE_SIZE));
  const [jumpPageInput, setJumpPageInput] = useState("1");
  const [isLoading, setIsLoading] = useState(() => !initialPayload);
  const [hasError, setHasError] = useState(false);
  const [filters, setFilters] = useState({
    type: "all",
    status: "all",
    location: "all",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadDevices() {
      const cachedPayload = getCachedJson(PAGE_DATA_URLS.devices);
      if (cachedPayload) {
        setDevices((cachedPayload.items ?? []).map(normalizeApiDevice));
        setIsLoading(false);
      }
      try {
        setIsLoading(!cachedPayload);
        setHasError(false);
        const data = await loadCachedJson(PAGE_DATA_URLS.devices, {
          force: Boolean(cachedPayload),
        });
        const apiDevices = (data.items ?? []).map(normalizeApiDevice);

        if (isMounted) {
          setDevices(apiDevices);
        }
      } catch {
        if (isMounted && !cachedPayload) {
          setHasError(true);
          setDevices([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDevices();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadCachedJson(PAGE_DATA_URLS.areas)
      .then((data) => {
        if (isMounted) setAreaOptions(data.items ?? []);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const requestedDeviceId = searchParams.get("device_id");
    if (
      requestedDeviceId &&
      devices.some((device) => device.id === requestedDeviceId)
    ) {
      setSelectedDeviceId(requestedDeviceId);
    }
  }, [devices, searchParams]);

  const displayedDevices = useMemo(
    () => filterDevices(devices, filters, activeTab, keyword),
    [activeTab, devices, filters, keyword]
  );
  const pageSize = Math.max(1, Number.parseInt(pageSizeInput, 10) || 1);
  const totalPages = Math.max(
    1,
    Math.ceil(displayedDevices.length / pageSize)
  );
  const normalizedPage = Math.min(currentPage, totalPages);
  const pagedDevices = displayedDevices.slice(
    (normalizedPage - 1) * pageSize,
    normalizedPage * pageSize
  );
  const tabCounts = useMemo(
    () =>
      DEVICE_TABS.reduce((counts, tab) => {
        counts[tab.key] =
          tab.key === "all"
            ? devices.length
            : devices.filter((device) => device.status === tab.key).length;
        return counts;
      }, {}),
    [devices]
  );
  const selectedDevice =
    devices.find((device) => device.id === selectedDeviceId) ?? null;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filters, keyword]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
      return;
    }

    setJumpPageInput(String(normalizedPage));
  }, [currentPage, normalizedPage, totalPages]);

  function commitJumpPage(value) {
    const parsedPage = Number.parseInt(value, 10);
    const nextPage = Number.isFinite(parsedPage)
      ? Math.min(Math.max(parsedPage, 1), totalPages)
      : normalizedPage;

    setCurrentPage(nextPage);
    setJumpPageInput(String(nextPage));
  }

  function commitPageSize(value) {
    const parsedSize = Number.parseInt(value, 10);
    const nextSize = Number.isFinite(parsedSize)
      ? Math.max(1, parsedSize)
      : DEFAULT_PAGE_SIZE;

    setPageSizeInput(String(nextSize));
    setCurrentPage(1);
  }

  async function refreshDeviceList() {
    const data = await loadCachedJson(PAGE_DATA_URLS.devices, { force: true });
    const nextDevices = (data.items ?? []).map(normalizeApiDevice);
    setDevices(nextDevices);
    return nextDevices;
  }

  async function parseMutationError(response, fallback) {
    try {
      const payload = await response.json();
      return payload.detail || fallback;
    } catch {
      return fallback;
    }
  }

  async function handleUpdateDevice(payload) {
    if (!editDevice || isMutating) return;
    setIsMutating(true);
    setMutationError("");
    try {
      const response = await fetch(`${API_BASE_URL}/devices/${editDevice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseMutationError(response, "设备信息保存失败"));
      }
      await refreshDeviceList();
      setEditDevice(null);
    } catch (error) {
      setMutationError(error.message || "设备信息保存失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDeleteDevice() {
    if (!deleteDevice || isMutating) return;
    setIsMutating(true);
    setMutationError("");
    try {
      const response = await fetch(`${API_BASE_URL}/devices/${deleteDevice.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(await parseMutationError(response, "设备删除失败"));
      }
      setDevices((current) =>
        current.filter((device) => device.id !== deleteDevice.id)
      );
      setSelectedDeviceId(null);
      setDeleteDevice(null);
      await refreshDeviceList();
    } catch (error) {
      setMutationError(error.message || "设备删除失败");
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <PageShell $hasDrawer={Boolean(selectedDevice)}>
      <ContentColumn>
        <PageTitle>设备管理</PageTitle>

        <FilterBar>
          <FilterGroup>
            <FilterLabel>设备类型</FilterLabel>
            <FilterSelect
              value={filters.type}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  type: event.target.value,
                }))
              }
            >
              <option value="all">全部</option>
              <option value="温">温湿度</option>
              <option value="烟">烟感</option>
              <option value="门">门磁</option>
              <option value="气">气体</option>
              <option value="摄像">摄像头</option>
            </FilterSelect>
          </FilterGroup>
          <FilterGroup>
            <FilterLabel>设备状态</FilterLabel>
            <FilterSelect
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
            >
              <option value="all">全部</option>
              <option value="online">在线</option>
              <option value="offline">离线</option>
              <option value="alarm">告警</option>
              <option value="fault">异常</option>
            </FilterSelect>
          </FilterGroup>
          <FilterGroup>
            <FilterLabel>所在位置</FilterLabel>
            <FilterSelect
              value={filters.location}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  location: event.target.value,
                }))
              }
            >
              <option value="all">全部</option>
              <option value="1号楼">1号楼</option>
              <option value="2号楼">2号楼</option>
              <option value="3号楼">3号楼</option>
              <option value="大门">大门</option>
            </FilterSelect>
          </FilterGroup>
          <SearchBox>
            <Search size={15} />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="请输入设备名称或设备ID"
            />
          </SearchBox>
          <ResetButton
            type="button"
            onClick={() => {
              setKeyword("");
              setFilters({ type: "all", status: "all", location: "all" });
              setActiveTab("all");
            }}
          >
            重置
          </ResetButton>
          <PrimaryAction type="button">+ 新增设备</PrimaryAction>
        </FilterBar>

        <ListPanel>
          <TabsRow>
            <Tabs>
              {DEVICE_TABS.map((tab) => (
                <TabButton
                  key={tab.key}
                  type="button"
                  $active={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}（{tabCounts[tab.key] ?? 0}）
                </TabButton>
              ))}
            </Tabs>
            <BatchButton type="button">
              批量操作
              <ChevronDown size={14} />
            </BatchButton>
          </TabsRow>

          <CardGrid>
            {isLoading ? (
              <ListPlaceholder>正在加载设备信息...</ListPlaceholder>
            ) : hasError ? (
              <ListPlaceholder>设备信息加载失败</ListPlaceholder>
            ) : pagedDevices.length === 0 ? (
              <ListPlaceholder>暂无匹配设备</ListPlaceholder>
            ) : (
              pagedDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  isSelected={device.id === selectedDeviceId}
                  onSelect={() => setSelectedDeviceId(device.id)}
                />
              ))
            )}
          </CardGrid>
        </ListPanel>

        <PaginationRow>
          <TotalText>共 {displayedDevices.length} 条</TotalText>
          <PageControls>
            <PageButton
              type="button"
              disabled={normalizedPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              <ChevronLeft size={14} />
            </PageButton>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (page) => (
                <PageNumber
                  key={page}
                  type="button"
                  $active={page === normalizedPage}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </PageNumber>
              )
            )}
            <PageButton
              type="button"
              disabled={normalizedPage === totalPages}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
            >
              <ChevronRight size={14} />
            </PageButton>
            <PageSizeControl>
              <PageSizeInput
                value={pageSizeInput}
                inputMode="numeric"
                onChange={(event) =>
                  setPageSizeInput(event.target.value.replace(/\D/g, ""))
                }
                onBlur={(event) => commitPageSize(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                aria-label="每页条数"
              />
              <span>条/页</span>
            </PageSizeControl>
            <JumpText>跳至</JumpText>
            <JumpInput
              value={jumpPageInput}
              inputMode="numeric"
              onChange={(event) =>
                setJumpPageInput(event.target.value.replace(/\D/g, ""))
              }
              onBlur={(event) => commitJumpPage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitJumpPage(event.currentTarget.value);
                }
              }}
              aria-label="跳转页码"
            />
            <JumpText>页</JumpText>
          </PageControls>
        </PaginationRow>
      </ContentColumn>

      {selectedDevice ? (
        <DetailDrawer
          device={selectedDevice}
          onClose={() => setSelectedDeviceId(null)}
          onEdit={() => {
            setMutationError("");
            setEditDevice(selectedDevice);
          }}
          onDelete={() => {
            setMutationError("");
            setDeleteDevice(selectedDevice);
          }}
          isMutating={isMutating}
        />
      ) : null}
      {editDevice ? (
        <DeviceEditDialog
          key={editDevice.id}
          device={editDevice}
          areas={areaOptions}
          busy={isMutating}
          error={mutationError}
          onClose={() => !isMutating && setEditDevice(null)}
          onSubmit={handleUpdateDevice}
        />
      ) : null}
      {deleteDevice ? (
        <DeviceDeleteDialog
          device={deleteDevice}
          busy={isMutating}
          error={mutationError}
          onClose={() => !isMutating && setDeleteDevice(null)}
          onConfirm={handleDeleteDevice}
        />
      ) : null}
    </PageShell>
  );
}

const PageShell = styled.div`
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: ${(p) =>
    p.$hasDrawer ? "minmax(0, 1fr) 410px" : "minmax(0, 1fr)"};
  gap: 0;
  overflow: hidden;
  background: hsl(216 26% 97%);
  transition: grid-template-columns 180ms ease;
`;

const ContentColumn = styled.div`
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 12px;
  padding: ${BUSINESS_PAGE_LAYOUT.padding};
  overflow: hidden;
`;

const PageTitle = styled.h1`
  margin: 0;
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.peoplePageTitle};
  font-weight: 700;
  line-height: ${BUSINESS_PAGE_LAYOUT.titleLineHeight};
`;

const FilterBar = styled.div`
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(132px, 154px) minmax(132px, 154px) minmax(
      132px,
      154px
    ) minmax(150px, 1fr) 46px 76px;
  gap: 8px;
  align-items: end;
`;

const FilterGroup = styled.label`
  min-width: 0;
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
`;

const FilterLabel = styled.span`
  color: hsl(218 15% 25%);
  font-size: ${FONT_SIZES.peopleDetailLabel};
  white-space: nowrap;
`;

const FilterSelect = styled.select`
  width: 100%;
  height: 34px;
  border: 1px solid hsl(220 13% 84%);
  border-radius: 6px;
  padding: 0 10px;
  color: hsl(218 15% 24%);
  background: white;
  font-size: ${FONT_SIZES.peopleSearchInput};
  outline: none;
`;

const SearchBox = styled.label`
  height: 34px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid hsl(220 13% 84%);
  border-radius: 6px;
  padding: 0 10px;
  color: hsl(218 10% 52%);
  background: white;

  input {
    min-width: 0;
    flex: 1;
    border: 0;
    color: hsl(218 15% 24%);
    background: transparent;
    font-size: ${FONT_SIZES.peopleSearchInput};
    outline: none;
  }
`;

const ResetButton = styled.button`
  height: 34px;
  width: 46px;
  border: 1px solid hsl(220 13% 86%);
  border-radius: 6px;
  color: hsl(218 10% 38%);
  background: white;
  font-size: ${FONT_SIZES.peopleSearchInput};
  font-weight: 700;
  cursor: pointer;
`;

const PrimaryAction = styled.button`
  height: 34px;
  width: 76px;
  border: 0;
  border-radius: 6px;
  color: white;
  background: hsl(217 93% 52%);
  font-size: ${FONT_SIZES.peopleSearchInput};
  font-weight: 700;
  cursor: pointer;
`;

const ListPanel = styled.section`
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border: 1px solid hsl(220 13% 88%);
  border-radius: 8px;
  background: white;
  overflow: hidden;
`;

const TabsRow = styled.div`
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid hsl(220 13% 90%);
  padding: 0 12px 0 18px;
`;

const Tabs = styled.div`
  min-width: 0;
  display: flex;
  gap: 34px;
  overflow: auto;
`;

const TabButton = styled.button`
  height: 48px;
  border: 0;
  border-bottom: 2px solid
    ${(p) => (p.$active ? "hsl(217 93% 52%)" : "transparent")};
  color: ${(p) => (p.$active ? "hsl(217 93% 52%)" : "hsl(218 10% 36%)")};
  background: transparent;
  font-size: ${FONT_SIZES.peopleTable};
  font-weight: ${(p) => (p.$active ? 700 : 600)};
  white-space: nowrap;
  cursor: pointer;
`;

const BatchButton = styled.button`
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid hsl(220 13% 86%);
  border-radius: 6px;
  padding: 0 10px;
  color: hsl(218 10% 38%);
  background: white;
  font-size: ${FONT_SIZES.peopleSearchInput};
  font-weight: 700;
  cursor: pointer;
`;

const CardGrid = styled.div`
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(284px, 1fr));
  grid-auto-rows: minmax(188px, auto);
  align-content: start;
  gap: 12px;
  padding: 12px;
  overflow: auto;
`;

const ListPlaceholder = styled.div`
  grid-column: 1 / -1;
  min-height: 220px;
  display: grid;
  place-items: center;
  color: hsl(218 10% 52%);
  font-size: ${FONT_SIZES.peopleTable};
`;

const DeviceCardButton = styled.button`
  min-width: 0;
  min-height: 188px;
  border: 1px solid
    ${(p) => (p.$selected ? "hsl(217 93% 52%)" : "hsl(220 13% 89%)")};
  border-radius: 8px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  row-gap: 10px;
  padding: 12px;
  text-align: left;
  background: white;
  cursor: pointer;
`;

const DeviceCardTop = styled.div`
  min-width: 0;
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 20px;
  gap: 10px;
  align-items: start;
`;

const DeviceIcon = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: ${(p) =>
    ({
      blue: "hsl(217 93% 52%)",
      orange: "hsl(28 92% 54%)",
      gray: "hsl(215 11% 58%)",
    }[p.$tone] ?? "hsl(217 93% 52%)")};
  background: ${(p) =>
    ({
      blue: "hsl(217 93% 52% / 0.09)",
      orange: "hsl(28 92% 54% / 0.13)",
      gray: "hsl(215 18% 94%)",
    }[p.$tone] ?? "hsl(217 93% 52% / 0.09)")};
`;

const DeviceIdentity = styled.div`
  min-width: 0;
`;

const DeviceName = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.peopleTable};
  font-weight: 700;
  line-height: 1.25;
`;

const DeviceMeta = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 5px;
  color: hsl(218 10% 42%);
  font-size: ${FONT_SIZES.peopleDetailLabel};
  line-height: 1.25;
`;

const MoreButton = styled.button`
  width: 20px;
  height: 24px;
  border: 0;
  display: grid;
  place-items: center;
  color: hsl(218 23% 30%);
  background: transparent;
  cursor: pointer;
`;

const DeviceFacts = styled.div`
  display: grid;
  gap: 6px;
  align-content: start;
`;

const DeviceFact = styled.div`
  min-width: 0;
  display: grid;
  grid-template-columns: 42px auto minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 6px;
  color: hsl(218 10% 42%);
  font-size: ${FONT_SIZES.peopleDetailLabel};
  line-height: 1.25;

  > span:first-child {
    white-space: nowrap;
  }
`;

const StatusDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${(p) =>
    ({
      green: "hsl(154 78% 42%)",
      red: "hsl(0 83% 60%)",
      orange: "hsl(28 92% 54%)",
      gray: "hsl(218 10% 58%)",
    }[p.$tone] ?? "hsl(218 10% 58%)")};
`;

const StatusText = styled.span`
  color: ${(p) =>
    ({
      green: "hsl(154 78% 38%)",
      red: "hsl(0 83% 58%)",
      orange: "hsl(28 92% 50%)",
      gray: "hsl(218 10% 45%)",
    }[p.$tone] ?? "hsl(218 10% 45%)")};
  font-weight: 700;
`;

const SignalWrap = styled.span`
  display: inline-flex;
  align-items: end;
  gap: 2px;
  height: 17px;
`;

const SignalBar = styled.span`
  width: 4px;
  height: ${(p) => `${p.$height}px`};
  border-radius: 999px;
  background: ${(p) => (p.$active ? "hsl(154 78% 42%)" : "hsl(220 13% 88%)")};
`;

const ValueText = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: hsl(218 10% 34%);
  font-family: var(--font-data);
`;

const BatteryWrap = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: hsl(218 10% 34%);
  font-family: var(--font-data);

  span {
    color: ${(p) => (p.$low ? "hsl(0 83% 58%)" : "hsl(218 10% 34%)")};
  }
`;

const BatteryShell = styled.span`
  position: relative;
  width: 24px;
  height: 10px;
  border: 2px solid hsl(154 78% 42%);
  border-radius: 3px;

  &::after {
    content: "";
    position: absolute;
    right: -5px;
    top: 2px;
    width: 3px;
    height: 4px;
    border-radius: 0 2px 2px 0;
    background: hsl(154 78% 42%);
  }
`;

const BatteryFill = styled.span`
  position: absolute;
  left: 1px;
  top: 1px;
  bottom: 1px;
  width: ${(p) => `${p.$value}%`};
  max-width: calc(100% - 2px);
  border-radius: 1px;
  background: ${(p) => (p.$value < 25 ? "hsl(0 83% 60%)" : "hsl(154 78% 42%)")};
`;

const PowerText = styled.span`
  color: hsl(218 10% 34%);
`;

const PaginationRow = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

const TotalText = styled.div`
  color: hsl(218 10% 42%);
  font-size: ${FONT_SIZES.peopleTable};
`;

const PageControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PageButton = styled.button`
  width: 30px;
  height: 30px;
  border: 1px solid hsl(220 13% 86%);
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: hsl(218 10% 42%);
  background: white;

  &:disabled {
    color: hsl(218 10% 72%);
    cursor: default;
  }
`;

const PageNumber = styled(PageButton)`
  color: ${(p) => (p.$active ? "white" : "hsl(218 10% 38%)")};
  background: ${(p) => (p.$active ? "hsl(217 93% 52%)" : "white")};
  border-color: ${(p) => (p.$active ? "hsl(217 93% 52%)" : "hsl(220 13% 86%)")};
  font-family: var(--font-data);
  font-size: ${FONT_SIZES.peopleTable};
`;

const PageSizeControl = styled.label`
  height: 30px;
  border: 1px solid hsl(220 13% 86%);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  color: hsl(218 10% 38%);
  background: white;
  font-size: ${FONT_SIZES.peopleTable};
`;

const PageSizeInput = styled.input`
  width: 28px;
  border: 0;
  color: hsl(218 10% 34%);
  background: transparent;
  font-family: var(--font-data);
  font-size: ${FONT_SIZES.peopleTable};
  text-align: center;
  outline: none;
`;

const JumpText = styled.span`
  color: hsl(218 10% 42%);
  font-size: ${FONT_SIZES.peopleTable};
`;

const JumpInput = styled.input`
  width: 52px;
  height: 30px;
  border: 1px solid hsl(220 13% 86%);
  border-radius: 6px;
  color: hsl(218 10% 34%);
  background: white;
  text-align: center;
  font-size: ${FONT_SIZES.peopleTable};
`;

const Drawer = styled.aside`
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  border-left: 1px solid hsl(220 13% 88%);
  background: white;
`;

const DrawerHeader = styled.div`
  min-height: 62px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 20px;
`;

const DrawerTitle = styled.h2`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.peopleSelectedName};
  font-weight: 700;
`;

const DrawerTitleText = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CopyButton = styled.button`
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 5px;
  display: grid;
  place-items: center;
  color: hsl(218 10% 50%);
  background: transparent;
  cursor: pointer;

  &:hover {
    color: hsl(217 93% 52%);
    background: hsl(217 93% 52% / 0.08);
  }
`;

const StatusBadge = styled.span`
  border-radius: 5px;
  padding: 3px 7px;
  color: hsl(154 78% 38%);
  background: hsl(154 78% 42% / 0.12);
  font-size: ${FONT_SIZES.peopleBadge};
  font-weight: 700;
`;

const CloseDrawerButton = styled.button`
  width: 30px;
  height: 30px;
  border: 0;
  display: grid;
  place-items: center;
  color: hsl(218 10% 42%);
  background: transparent;
  cursor: pointer;
`;

const DrawerTabs = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-bottom: 1px solid hsl(220 13% 90%);
  padding: 0 20px;
`;

const DrawerTab = styled.button`
  height: 42px;
  border: 0;
  border-bottom: 2px solid
    ${(p) => (p.$active ? "hsl(217 93% 52%)" : "transparent")};
  color: ${(p) => (p.$active ? "hsl(217 93% 52%)" : "hsl(218 10% 34%)")};
  background: transparent;
  font-size: ${FONT_SIZES.peopleTable};
  font-weight: 700;
  cursor: pointer;
`;

const DrawerBody = styled.div`
  min-height: 0;
  overflow: auto;
  padding: 18px 20px 16px;
`;

const DeviceOverview = styled.div`
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 14px;
`;

const LargeDeviceIcon = styled(DeviceIcon)`
  width: 70px;
  height: 70px;
`;

const DeviceInfoGrid = styled.div`
  min-width: 0;
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 9px 10px;
  align-items: center;
`;

const InfoLabel = styled.div`
  justify-self: start;
  color: hsl(218 10% 48%);
  font-size: ${FONT_SIZES.peopleDetailLabel};
  white-space: nowrap;
`;

const InfoValue = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  justify-self: start;
  color: hsl(218 15% 24%);
  font-size: ${FONT_SIZES.peopleDetailValue};
  font-weight: 600;
  overflow-wrap: anywhere;
`;

const HealthBlock = styled.div`
  grid-column: 1;
  display: grid;
  place-items: center;
  gap: 8px;
  margin-top: 10px;
`;

const TabFailureState = styled.div`
  min-height: 260px;
  display: grid;
  place-items: center;
  color: hsl(218 10% 52%);
  font-size: ${FONT_SIZES.peopleTable};
`;

const SmallLabel = styled.div`
  color: hsl(218 10% 42%);
  font-size: ${FONT_SIZES.peopleDetailLabel};
`;

const HealthRingWrap = styled.div`
  width: 86px;
  height: 86px;

  svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  circle {
    fill: none;
    stroke: hsl(220 13% 91%);
    stroke-width: 6;
  }

  circle + circle {
    stroke: hsl(128 68% 49%);
    stroke-linecap: round;
  }

  text {
    transform: rotate(90deg);
    transform-origin: 41px 41px;
    text-anchor: middle;
    fill: hsl(128 68% 40%);
    font-family: var(--font-data);
    font-weight: 800;
  }

  text:first-of-type {
    font-size: ${FONT_SIZES.peopleSelectedName};
  }

  text:last-of-type {
    font-size: ${FONT_SIZES.peopleBadge};
  }
`;

const Divider = styled.div`
  height: 1px;
  margin: 16px 0 10px;
  background: hsl(220 13% 90%);
`;

const SectionHeader = styled.div`
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
`;

const SectionTitle = styled.h3`
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.peopleTable};
  font-weight: 700;
`;

const ViewAllButton = styled.button`
  border: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: hsl(217 93% 52%);
  background: transparent;
  font-size: ${FONT_SIZES.peopleDetailLabel};
  font-weight: 700;
`;

const ScoreGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
`;

const ScoreCard = styled.div`
  min-height: 76px;
  border: 1px solid hsl(220 13% 90%);
  border-radius: 6px;
  display: grid;
  place-items: center;
  gap: 2px;
  padding: 8px 4px;
`;

const ScoreLabel = styled.div`
  color: hsl(218 10% 46%);
  font-size: ${FONT_SIZES.peopleDetailLabel};
`;

const ScoreValue = styled.div`
  color: ${COLORS.gray10};
  font-family: var(--font-data);
  font-size: ${FONT_SIZES.dashboardMetricValue};
  font-weight: 800;
`;

const ScoreState = styled.div`
  position: relative;
  padding-left: 12px;
  color: hsl(154 78% 38%);
  font-size: ${FONT_SIZES.peopleBadge};
  font-weight: 700;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: hsl(154 78% 42%);
    transform: translateY(-50%);
  }
`;

const AlarmList = styled.div`
  display: grid;
  gap: 10px;
`;

const DrawerEmpty = styled.div`
  min-height: 42px;
  display: grid;
  place-items: center;
  color: hsl(218 10% 52%);
  font-size: ${FONT_SIZES.peopleDetailLabel};
`;

const AlarmItem = styled.div`
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 130px 52px;
  align-items: center;
  gap: 8px;
  color: hsl(218 15% 24%);
  font-size: ${FONT_SIZES.peopleDetailLabel};
`;

const AlarmIcon = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: white;
  background: ${(p) =>
    ({
      red: "hsl(0 83% 60%)",
      yellow: "hsl(44 95% 52%)",
      orange: "hsl(28 92% 58%)",
    }[p.$tone] ?? "hsl(28 92% 58%)")};
`;

const AlarmName = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const AlarmTime = styled.div`
  color: hsl(218 10% 48%);
  font-family: var(--font-data);
`;

const RecoveredBadge = styled.span`
  justify-self: end;
  border-radius: 5px;
  padding: 3px 6px;
  color: hsl(154 78% 38%);
  background: hsl(154 78% 42% / 0.1);
  font-size: ${FONT_SIZES.peopleBadge};
  font-weight: 700;
`;

const MaintenanceTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${FONT_SIZES.peopleDetailLabel};

  th,
  td {
    height: 30px;
    padding: 0 6px;
    color: hsl(218 15% 24%);
    text-align: left;
    white-space: nowrap;
  }

  th {
    color: hsl(218 10% 48%);
    background: hsl(216 26% 98%);
    font-weight: 700;
  }
`;

const EmptyTableCell = styled.td`
  height: 44px !important;
  text-align: center !important;
  color: hsl(218 10% 52%) !important;
`;

const DrawerFooter = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  border-top: 1px solid hsl(220 13% 90%);
  padding: 14px 20px;
`;

const SecondaryAction = styled.button`
  height: 34px;
  border: 1px solid hsl(220 13% 86%);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: hsl(218 15% 24%);
  background: white;
  font-size: ${FONT_SIZES.peopleSearchInput};
  font-weight: 700;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.58;
  }
`;

const DangerAction = styled(SecondaryAction)`
  border-color: hsl(0 83% 70%);
  color: hsl(0 83% 55%);
`;

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1400;
  display: grid;
  place-items: center;
  padding: 24px;
  background: hsl(218 30% 12% / 0.42);
`;

const EditDialog = styled.div`
  width: min(620px, calc(100vw - 48px));
  overflow: hidden;
  border: 1px solid hsl(220 15% 88%);
  border-radius: 8px;
  background: white;
  box-shadow: 0 20px 55px hsl(218 30% 12% / 0.24);
`;

const DialogHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 17px 20px;
  border-bottom: 1px solid hsl(220 15% 91%);

  > div {
    display: grid;
    gap: 3px;
  }

  strong {
    color: hsl(218 24% 18%);
    font-size: 17px;
  }

  span {
    color: hsl(218 10% 52%);
    font-size: 12px;
  }
`;

const DeviceForm = styled.form`
  padding: 18px 20px 20px;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
`;

const FormField = styled.label`
  display: grid;
  gap: 7px;
  min-width: 0;
  color: hsl(218 13% 38%);
  font-size: 13px;
  font-weight: 600;

  input,
  select {
    box-sizing: border-box;
    width: 100%;
    height: 36px;
    border: 1px solid hsl(220 14% 84%);
    border-radius: 5px;
    padding: 0 10px;
    outline: none;
    color: hsl(218 20% 20%);
    background: white;
    font: inherit;
    font-weight: 500;
  }

  input:focus,
  select:focus {
    border-color: hsl(216 92% 58%);
    box-shadow: 0 0 0 2px hsl(216 92% 58% / 0.12);
  }
`;

const DialogError = styled.div`
  margin-top: 14px;
  border-radius: 5px;
  padding: 9px 11px;
  color: hsl(0 72% 43%);
  background: hsl(0 88% 97%);
  font-size: 13px;
`;

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;

  > button {
    min-width: 96px;
  }
`;

const DeleteDialog = styled.div`
  width: min(410px, calc(100vw - 48px));
  border-radius: 8px;
  padding: 24px;
  background: white;
  box-shadow: 0 20px 55px hsl(218 30% 12% / 0.24);

  > strong {
    display: block;
    margin-top: 14px;
    color: hsl(218 24% 18%);
    font-size: 17px;
  }

  > p {
    margin: 9px 0 0;
    color: hsl(218 10% 45%);
    font-size: 13px;
    line-height: 1.7;
  }
`;

const DeleteIcon = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: hsl(0 78% 52%);
  background: hsl(0 88% 96%);
`;

const ConfirmDeleteButton = styled(SecondaryAction)`
  border-color: hsl(0 72% 54%);
  color: white;
  background: hsl(0 72% 54%);
`;

export default DeviceManagement;
