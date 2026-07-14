import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  Activity,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  DoorOpen,
  Droplets,
  EllipsisVertical,
  Flame,
  Gauge,
  Radio,
  RotateCcw,
  Search,
  Thermometer,
  Trash2,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { COLORS, FONT_SIZES } from "../constants/STYLES";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

const DEVICE_TABS = [
  { key: "all", label: "全部设备", count: 1560 },
  { key: "online", label: "在线", count: 1368 },
  { key: "offline", label: "离线", count: 128 },
  { key: "alarm", label: "告警", count: 64 },
  { key: "fault", label: "异常", count: 4 },
];

const DEVICE_DEMO_ITEMS = [
  {
    id: "TEMP-1F-001",
    name: "温湿度传感器-1F-001",
    type: "温湿度传感器",
    status: "online",
    signal: -65,
    battery: 86,
    location: "1号楼 / 1层 / 配电间",
    heartbeat: "2025-06-30 16:28:15",
    iconType: "temperature",
    iconTone: "blue",
    health: 96,
    organization: "石安盾科技园区",
    installTime: "2024-12-18 09:30:00",
    firmware: "v2.3.7",
    hardware: "v1.1",
    protocol: "LoRaWAN",
    healthScores: [98, 95, 94, 96],
  },
  {
    id: "SMK-2F-015",
    name: "烟感探测器-2F-015",
    type: "烟感探测器",
    status: "online",
    signal: -72,
    battery: 92,
    location: "2号楼 / 2层 / 办公区B",
    heartbeat: "2025-06-30 16:28:07",
    iconType: "smoke",
    iconTone: "gray",
    health: 95,
  },
  {
    id: "DOOR-3F-003",
    name: "门磁传感器-3F-003",
    type: "门磁传感器",
    status: "online",
    signal: -68,
    battery: 71,
    location: "3号楼 / 3层 / 机房门",
    heartbeat: "2025-06-30 16:27:59",
    iconType: "door",
    iconTone: "gray",
    health: 91,
  },
  {
    id: "LEAK-B1-002",
    name: "水浸传感器-B1-002",
    type: "水浸传感器",
    status: "offline",
    signal: null,
    battery: 23,
    location: "1号楼 / 地下1层 / 水泵房",
    heartbeat: "2025-06-30 12:14:32",
    iconType: "water",
    iconTone: "blue",
    health: 52,
  },
  {
    id: "METER-1F-008",
    name: "智能电表-1F-008",
    type: "智能电表",
    status: "online",
    signal: -58,
    battery: null,
    location: "1号楼 / 1层 / 配电箱A",
    heartbeat: "2025-06-30 16:28:12",
    iconType: "meter",
    iconTone: "gray",
    health: 93,
    powerMode: "外部供电",
  },
  {
    id: "PIR-2F-021",
    name: "红外人体探测器-2F-021",
    type: "红外人体探测器",
    status: "online",
    signal: -75,
    battery: 88,
    location: "2号楼 / 2层 / 走廊",
    heartbeat: "2025-06-30 16:28:01",
    iconType: "pir",
    iconTone: "gray",
    health: 89,
  },
  {
    id: "GAS-B1-006",
    name: "可燃气体探测器-B1-006",
    type: "可燃气体探测器",
    status: "alarm",
    signal: -61,
    battery: 64,
    location: "1号楼 / 地下1层 / 厨房",
    heartbeat: "2025-06-30 16:27:48",
    iconType: "gas",
    iconTone: "orange",
    health: 75,
  },
  {
    id: "CAM-GATE-01",
    name: "摄像头-大门-01",
    type: "网络摄像头",
    status: "online",
    signal: -55,
    battery: null,
    location: "大门口",
    heartbeat: "2025-06-30 16:28:18",
    iconType: "camera",
    iconTone: "gray",
    health: 90,
    powerMode: "外部供电",
  },
  {
    id: "TEMP-3F-009",
    name: "温湿度传感器-3F-009",
    type: "温湿度传感器",
    status: "fault",
    signal: -82,
    battery: 18,
    location: "3号楼 / 3层 / 资料室",
    heartbeat: "2025-06-30 16:20:34",
    iconType: "temperature",
    iconTone: "blue",
    health: 48,
  },
];

const RECENT_ALARMS = [
  {
    type: "温度超限告警",
    time: "2025-06-29 14:22:31",
    status: "已恢复",
    tone: "red",
  },
  {
    type: "设备电量低",
    time: "2025-06-28 09:11:07",
    status: "已恢复",
    tone: "yellow",
  },
  {
    type: "信号弱告警",
    time: "2025-06-25 16:45:21",
    status: "已恢复",
    tone: "orange",
  },
];

const MAINTENANCE_ROWS = [
  {
    type: "巡检",
    content: "例行设备巡检",
    person: "李工",
    time: "2025-06-20 10:15",
  },
  {
    type: "调试",
    content: "校准温湿度传感器",
    person: "张工",
    time: "2025-05-18 14:30",
  },
  {
    type: "更换电池",
    content: "更换电池",
    person: "王工",
    time: "2025-04-12 09:20",
  },
];

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
    signal: realtime.signal_strength == null ? null : -Math.round(100 - realtime.signal_strength / 2),
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
        .some((value) => String(value).toLowerCase().includes(normalizedKeyword));

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
  const bars = value == null ? 0 : Math.max(1, Math.min(5, Math.round((100 + value) / 8)));

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
        <MoreButton type="button" aria-label="更多操作" onClick={(event) => event.stopPropagation()}>
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
          <ValueText>{device.signal == null ? "--" : `${device.signal} dBm`}</ValueText>
        </DeviceFact>
        <DeviceFact>
          <span>电量：</span>
          <BatteryIndicator value={device.battery} powerMode={device.powerMode} />
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

function DetailDrawer({ device, onClose }) {
  const healthScores = device.healthScores ?? [
    Math.min(99, device.health + 2),
    Math.max(70, device.health - 1),
    Math.max(70, device.health - 2),
    device.health,
  ];
  const alarms = device.recentAlarms?.length ? device.recentAlarms : RECENT_ALARMS;

  return (
    <Drawer>
      <DrawerHeader>
        <DrawerTitle>
          {device.name}
          <StatusBadge $tone={statusTone[device.status]}>{statusLabels[device.status]}</StatusBadge>
        </DrawerTitle>
        <CloseDrawerButton type="button" aria-label="关闭详情" onClick={onClose}>
          <X size={18} />
        </CloseDrawerButton>
      </DrawerHeader>

      <DrawerTabs>
        <DrawerTab $active>设备详情</DrawerTab>
        <DrawerTab>运行数据</DrawerTab>
        <DrawerTab>告警记录</DrawerTab>
        <DrawerTab>维护记录</DrawerTab>
      </DrawerTabs>

      <DrawerBody>
        <DeviceOverview>
          <LargeDeviceIcon $tone={device.iconTone}>
            <DeviceGlyph type={device.iconType} />
          </LargeDeviceIcon>
          <DeviceInfoGrid>
            <InfoLabel>设备ID</InfoLabel>
            <InfoValue>
              {device.id}
              <Copy size={13} />
            </InfoValue>
            <InfoLabel>设备类型</InfoLabel>
            <InfoValue>{device.type}</InfoValue>
            <InfoLabel>所属组织</InfoLabel>
            <InfoValue>{device.organization ?? "石安盾科技园区"}</InfoValue>
            <InfoLabel>安装位置</InfoLabel>
            <InfoValue>{device.location}</InfoValue>
            <InfoLabel>安装时间</InfoLabel>
            <InfoValue>{device.installTime ?? "2024-12-18 09:30:00"}</InfoValue>
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
              <BatteryIndicator value={device.battery} powerMode={device.powerMode} />
            </InfoValue>
            <InfoLabel>固件版本</InfoLabel>
            <InfoValue>{device.firmware ?? "v2.3.7"}</InfoValue>
            <InfoLabel>硬件版本</InfoLabel>
            <InfoValue>{device.hardware ?? "v1.1"}</InfoValue>
            <InfoLabel>通信协议</InfoLabel>
            <InfoValue>{device.protocol ?? "LoRaWAN"}</InfoValue>
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
          {["稳定性", "数据完整性", "响应时效", "总体评分"].map((label, index) => (
            <ScoreCard key={label}>
              <ScoreLabel>{label}</ScoreLabel>
              <ScoreValue>{healthScores[index]}</ScoreValue>
              <ScoreState>优</ScoreState>
            </ScoreCard>
          ))}
        </ScoreGrid>

        <SectionHeader>
          <SectionTitle>最近告警</SectionTitle>
          <ViewAllButton type="button">查看全部 <ChevronRight size={12} /></ViewAllButton>
        </SectionHeader>
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

        <SectionHeader>
          <SectionTitle>维护记录</SectionTitle>
          <ViewAllButton type="button">查看全部 <ChevronRight size={12} /></ViewAllButton>
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
            {MAINTENANCE_ROWS.map((row) => (
              <tr key={`${row.type}-${row.time}`}>
                <td>{row.type}</td>
                <td>{row.content}</td>
                <td>{row.person}</td>
                <td>{row.time}</td>
              </tr>
            ))}
          </tbody>
        </MaintenanceTable>
      </DrawerBody>

      <DrawerFooter>
        <SecondaryAction type="button">
          <ClipboardList size={15} />
          编辑设备
        </SecondaryAction>
        <SecondaryAction type="button">
          <RotateCcw size={15} />
          重启设备
        </SecondaryAction>
        <DangerAction type="button">
          <Trash2 size={15} />
          删除设备
        </DangerAction>
      </DrawerFooter>
    </Drawer>
  );
}

function DeviceManagement() {
  const [devices, setDevices] = useState(DEVICE_DEMO_ITEMS);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [filters, setFilters] = useState({
    type: "all",
    status: "all",
    location: "all",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadDevices() {
      try {
        const response = await fetch(`${API_BASE_URL}/devices/overview`);

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const apiDevices = (data.items ?? []).map(normalizeApiDevice);

        if (isMounted && apiDevices.length > 0) {
          setDevices(apiDevices);
        }
      } catch {
        // Keep the screenshot-faithful demo data when the API is unavailable.
      }
    }

    loadDevices();

    return () => {
      isMounted = false;
    };
  }, []);

  const displayedDevices = useMemo(
    () => filterDevices(devices, filters, activeTab, keyword),
    [activeTab, devices, filters, keyword]
  );
  const selectedDevice =
    devices.find((device) => device.id === selectedDeviceId) ?? null;

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
                setFilters((current) => ({ ...current, type: event.target.value }))
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
                setFilters((current) => ({ ...current, status: event.target.value }))
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
                  {tab.label}（{tab.count}）
                </TabButton>
              ))}
            </Tabs>
            <BatchButton type="button">
              批量操作
              <ChevronDown size={14} />
            </BatchButton>
          </TabsRow>

          <CardGrid>
            {displayedDevices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                isSelected={device.id === selectedDeviceId}
                onSelect={() => setSelectedDeviceId(device.id)}
              />
            ))}
          </CardGrid>
        </ListPanel>

        <PaginationRow>
          <TotalText>共 1560 条</TotalText>
          <PageControls>
            <PageButton type="button">
              <ChevronLeft size={14} />
            </PageButton>
            {[1, 2, 3, 4, 5].map((page) => (
              <PageNumber key={page} type="button" $active={page === 1}>
                {page}
              </PageNumber>
            ))}
            <PageMore>...</PageMore>
            <PageNumber type="button">78</PageNumber>
            <PageButton type="button">
              <ChevronRight size={14} />
            </PageButton>
            <PageSizeButton type="button">
              20 条/页
              <ChevronDown size={14} />
            </PageSizeButton>
            <JumpText>跳至</JumpText>
            <JumpInput value="1" readOnly />
            <JumpText>页</JumpText>
          </PageControls>
        </PaginationRow>
      </ContentColumn>

      {selectedDevice ? (
        <DetailDrawer
          device={selectedDevice}
          onClose={() => setSelectedDeviceId(null)}
        />
      ) : null}
    </PageShell>
  );
}

const PageShell = styled.div`
  box-sizing: border-box;
  min-height: 100%;
  display: grid;
  grid-template-columns: ${(p) =>
    p.$hasDrawer ? "minmax(0, 1fr) 410px" : "minmax(0, 1fr)"};
  gap: 0;
  background: hsl(216 26% 97%);
  transition: grid-template-columns 180ms ease;
`;

const ContentColumn = styled.div`
  min-width: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 12px;
  padding: 20px 22px 10px;
`;

const PageTitle = styled.h1`
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.peoplePageTitle};
  font-weight: 700;
`;

const FilterBar = styled.div`
  min-width: 0;
  display: grid;
  grid-template-columns: 184px 184px 184px minmax(210px, 1fr) 64px 88px;
  gap: 12px;
  align-items: end;
`;

const FilterGroup = styled.label`
  min-width: 0;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
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
  border: 0;
  border-radius: 6px;
  color: white;
  background: hsl(217 93% 52%);
  box-shadow: 0 8px 16px hsl(217 93% 52% / 0.18);
  font-size: ${FONT_SIZES.peopleSearchInput};
  font-weight: 700;
  cursor: pointer;
`;

const ListPanel = styled.section`
  min-height: 0;
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
  border-bottom: 2px solid ${(p) => (p.$active ? "hsl(217 93% 52%)" : "transparent")};
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
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(284px, 1fr));
  gap: 12px;
  padding: 12px;
  overflow: auto;
`;

const DeviceCardButton = styled.button`
  min-width: 0;
  min-height: 154px;
  border: 1px solid ${(p) => (p.$selected ? "hsl(217 93% 52%)" : "hsl(220 13% 89%)")};
  border-radius: 8px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  row-gap: 12px;
  padding: 14px;
  text-align: left;
  background: white;
  box-shadow: ${(p) =>
    p.$selected
      ? "0 0 0 1px hsl(217 93% 52% / 0.65), 0 10px 26px hsl(217 93% 52% / 0.1)"
      : "0 8px 20px hsl(220 20% 10% / 0.04)"};
  cursor: pointer;
`;

const DeviceCardTop = styled.div`
  min-width: 0;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) 20px;
  gap: 12px;
  align-items: start;
`;

const DeviceIcon = styled.div`
  width: 58px;
  height: 58px;
  border-radius: 16px;
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
`;

const DeviceMeta = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 7px;
  color: hsl(218 10% 42%);
  font-size: ${FONT_SIZES.peopleDetailLabel};
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
  gap: 8px;
`;

const DeviceFact = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  color: hsl(218 10% 42%);
  font-size: ${FONT_SIZES.peopleDetailLabel};
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
`;

const PageNumber = styled(PageButton)`
  color: ${(p) => (p.$active ? "white" : "hsl(218 10% 38%)")};
  background: ${(p) => (p.$active ? "hsl(217 93% 52%)" : "white")};
  border-color: ${(p) => (p.$active ? "hsl(217 93% 52%)" : "hsl(220 13% 86%)")};
  font-family: var(--font-data);
  font-size: ${FONT_SIZES.peopleTable};
`;

const PageMore = styled.span`
  color: hsl(218 10% 44%);
  font-size: ${FONT_SIZES.peopleTable};
`;

const PageSizeButton = styled.button`
  height: 30px;
  border: 1px solid hsl(220 13% 86%);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  color: hsl(218 10% 38%);
  background: white;
  font-size: ${FONT_SIZES.peopleTable};
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
  box-shadow: -18px 0 46px hsl(220 20% 10% / 0.1);
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
  border-bottom: 2px solid ${(p) => (p.$active ? "hsl(217 93% 52%)" : "transparent")};
  color: ${(p) => (p.$active ? "hsl(217 93% 52%)" : "hsl(218 10% 34%)")};
  background: transparent;
  font-size: ${FONT_SIZES.peopleTable};
  font-weight: 700;
`;

const DrawerBody = styled.div`
  min-height: 0;
  overflow: auto;
  padding: 18px 20px 16px;
`;

const DeviceOverview = styled.div`
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 18px;
`;

const LargeDeviceIcon = styled(DeviceIcon)`
  width: 70px;
  height: 70px;
`;

const DeviceInfoGrid = styled.div`
  min-width: 0;
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr) 88px minmax(0, 1fr);
  gap: 12px 14px;
`;

const InfoLabel = styled.div`
  color: hsl(218 10% 48%);
  font-size: ${FONT_SIZES.peopleDetailLabel};
`;

const InfoValue = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: hsl(218 15% 24%);
  font-size: ${FONT_SIZES.peopleDetailValue};
  font-weight: 600;
`;

const HealthBlock = styled.div`
  grid-column: 1;
  display: grid;
  place-items: center;
  gap: 8px;
  margin-top: 10px;
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
`;

const DangerAction = styled(SecondaryAction)`
  border-color: hsl(0 83% 70%);
  color: hsl(0 83% 55%);
`;

export default DeviceManagement;
