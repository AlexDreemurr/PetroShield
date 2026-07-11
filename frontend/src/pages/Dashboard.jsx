import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import Icon from "../components/Icon/Icon";
import { COLORS } from "../constants/STYLES";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

const dashboardPalette = {
  blue: "hsl(214 92% 56%)",
  green: "hsl(158 64% 43%)",
  orange: "hsl(32 94% 57%)",
  red: "hsl(0 76% 60%)",
  gray: "hsl(220 9% 66%)",
  softBlue: "hsl(214 92% 56% / 0.12)",
  softGreen: "hsl(158 64% 43% / 0.12)",
  softOrange: "hsl(32 94% 57% / 0.14)",
  softRed: "hsl(0 76% 60% / 0.13)",
};

const metricCards = [
  {
    key: "online_person_count",
    title: "在线人员",
    unit: "人",
    icon: "UsersRound",
    tone: "blue",
  },
  {
    key: "device_online_rate",
    title: "设备在线率",
    unit: "%",
    icon: "ShieldCog",
    tone: "green",
  },
  {
    key: "today_alarm_count",
    title: "今日告警总数",
    unit: "条",
    icon: "Siren",
    tone: "red",
  },
  {
    key: "risk_area_count",
    title: "风险区域",
    unit: "处",
    icon: "ShieldAlert",
    tone: "amber",
  },
];

const personStatusConfig = [
  { key: "normal", label: "正常", color: dashboardPalette.blue },
  { key: "high_risk", label: "高风险", color: dashboardPalette.red },
  { key: "medium_risk", label: "中风险", color: dashboardPalette.orange },
  { key: "offline", label: "离线", color: dashboardPalette.gray },
];

const deviceStatusConfig = [
  { key: "online", label: "在线", color: dashboardPalette.blue },
  { key: "offline", label: "离线", color: dashboardPalette.orange },
  { key: "alarm", label: "告警", color: dashboardPalette.red },
];

const fallbackAlarmItems = [
  {
    title: "人员越界告警",
    meta: "张三 / 运行部",
    level: "严重",
    time: "16:28:15",
    tone: "red",
  },
  {
    title: "静止超时告警",
    meta: "李四 / 维护部",
    level: "中等",
    time: "16:25:42",
    tone: "orange",
  },
  {
    title: "未佩戴安全帽",
    meta: "王五 / 承包商",
    level: "中等",
    time: "16:20:18",
    tone: "orange",
  },
  {
    title: "区域入侵告警",
    meta: "赵六 / 巡检人员",
    level: "一般",
    time: "16:15:33",
    tone: "amber",
  },
  {
    title: "设备离线告警",
    meta: "AGV-023 / 运输机器人",
    level: "一般",
    time: "16:10:05",
    tone: "amber",
  },
];

function getAlarmTone(level) {
  if (["严重", "重大", "高"].includes(level)) {
    return "red";
  }

  if (["中等", "中", "较高"].includes(level)) {
    return "orange";
  }

  return "amber";
}

function formatAlarmTime(value) {
  if (!value) {
    return "--:--:--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function normalizeRealtimeAlarm(item) {
  const title = item.title ?? `${item.type ?? "未知"}告警`;
  const meta = item.meta ?? [item.person_name, item.department]
    .filter(Boolean)
    .join(" / ");

  return {
    title,
    meta: meta || item.device_name || item.status || "未关联对象",
    level: item.level ?? "一般",
    time: formatAlarmTime(item.time),
    tone: getAlarmTone(item.level),
  };
}

const factoryMarkers = [
  { id: "p1", label: "人", tone: "blue", x: 18, y: 28 },
  { id: "p2", label: "人", tone: "blue", x: 34, y: 44 },
  { id: "p3", label: "人", tone: "blue", x: 57, y: 32 },
  { id: "p4", label: "人", tone: "blue", x: 72, y: 56 },
  { id: "d1", label: "设", tone: "green", x: 26, y: 65 },
  { id: "d2", label: "设", tone: "green", x: 49, y: 52 },
  { id: "d3", label: "设", tone: "green", x: 78, y: 35 },
  { id: "a1", label: "警", tone: "red", x: 21, y: 48 },
  { id: "a2", label: "警", tone: "red", x: 83, y: 43 },
];

const trendDays = ["06-24", "06-25", "06-26", "06-27", "06-28", "06-29", "06-30"];
const alarmTrendLines = [
  { label: "严重", color: dashboardPalette.red, values: [30, 70, 50, 86, 52, 62, 18] },
  {
    label: "中等",
    color: dashboardPalette.orange,
    values: [20, 45, 33, 56, 32, 40, 12],
  },
  { label: "一般", color: "hsl(43 92% 58%)", values: [10, 28, 20, 36, 20, 22, 6] },
];
const onlineRateTrend = [94, 93, 95, 92.5, 94.5, 93, 93];
const heatmapRows = ["罐区A", "罐区B", "催化裂化区", "加氢装置区", "常减压装置区"];
const heatmapValues = [
  [28, 35, 46, 60, 38, 55, 31],
  [42, 62, 36, 41, 68, 50, 44],
  [34, 49, 56, 37, 58, 72, 47],
  [26, 32, 40, 48, 35, 43, 30],
  [23, 30, 52, 29, 44, 37, 33],
];

function Card({ title, value, unit, icon, tone, isLoading, hasError }) {
  const displayValue = isLoading || hasError ? "--" : value;

  return (
    <CardWrapper>
      <CardTopLine>
        <IconBadge $tone={tone}>
          <Icon id={icon} size={18} strokeWidth={1.9} />
        </IconBadge>
        <CardTitle>{title}</CardTitle>
      </CardTopLine>
      <MetricLine>
        <MetricValue>{displayValue}</MetricValue>
        <MetricUnit>{unit}</MetricUnit>
      </MetricLine>
      <MetricFooter>
        <MetricDelta $tone={tone}>{tone === "red" ? "+1" : "+1.2%"}</MetricDelta>
        <MetricLabel>{hasError ? "数据获取失败" : "较昨日"}</MetricLabel>
      </MetricFooter>
    </CardWrapper>
  );
}

function DonutChart({ items, shouldShowValue }) {
  const size = 96;
  const strokeWidth = 13;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = items.reduce((sum, item) => sum + item.count, 0);
  let usedLength = 0;

  return (
    <DonutSvg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="hsl(220 13% 92%)"
        strokeWidth={strokeWidth}
      />
      {shouldShowValue &&
        total > 0 &&
        items.map((item) => {
          const segmentLength = (item.count / total) * circumference;
          const segmentOffset = -usedLength;
          usedLength += segmentLength;

          return (
            <circle
              key={item.key}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${segmentLength} ${
                circumference - segmentLength
              }`}
              strokeDashoffset={segmentOffset}
              transform={`rotate(-90 ${center} ${center})`}
            />
          );
        })}
      <text
        x={center}
        y={center - 7}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="hsl(218 10% 55%)"
        fontSize="11"
        fontWeight="500"
      >
        总数
      </text>
      <text
        x={center}
        y={center + 14}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={COLORS.gray10}
        fontSize="20"
        fontWeight="700"
      >
        {shouldShowValue ? total : "--"}
      </text>
    </DonutSvg>
  );
}

function DistributionCard({
  title,
  distribution,
  config,
  unit,
  isLoading,
  hasError,
}) {
  const items = useMemo(
    () =>
      config.map((item) => {
        const source = distribution?.[item.key];

        return {
          ...item,
          label: source?.label ?? item.label,
          count: Number(source?.count ?? 0),
          ratio: Number(source?.ratio ?? 0),
        };
      }),
    [config, distribution]
  );

  const shouldShowValue = !isLoading && !hasError;

  return (
    <DistributionWrapper>
      <DistributionTitle>{title}</DistributionTitle>
      <DistributionBody>
        <DonutFrame>
          <DonutChart items={items} shouldShowValue={shouldShowValue} />
        </DonutFrame>
        <LegendList>
          {items.map((item) => (
            <LegendItem key={item.key}>
              <LegendDot $color={item.color} />
              <LegendText>
                <LegendLabel>{item.label}</LegendLabel>
                <LegendValue>
                  {shouldShowValue ? `${item.count}${unit}` : "--"}
                  <LegendRatio>
                    {shouldShowValue ? `${item.ratio}%` : "--"}
                  </LegendRatio>
                </LegendValue>
              </LegendText>
            </LegendItem>
          ))}
        </LegendList>
      </DistributionBody>
    </DistributionWrapper>
  );
}

function DashboardSection({ title, action, children, className }) {
  return (
    <Panel className={className}>
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
        {action ? <PanelAction>{action}</PanelAction> : null}
      </PanelHeader>
      {children}
    </Panel>
  );
}

function FactoryMapCard() {
  return (
    <DashboardSection
      title="厂区人员与设备分布"
      action={
        <MapToggles>
          <TogglePill>人员</TogglePill>
          <TogglePill>设备</TogglePill>
          <TogglePill>告警</TogglePill>
          <TogglePill>风险区域</TogglePill>
        </MapToggles>
      }
    >
      <FactoryMap>
        <MapZone $tone="red" $left={8} $top={18} $width={22} $height={30}>
          加氢装置区
        </MapZone>
        <MapZone $tone="orange" $left={70} $top={28} $width={22} $height={32}>
          罐区A
        </MapZone>
        <MapZone $tone="blue" $left={39} $top={13} $width={20} $height={16}>
          催化裂化区
        </MapZone>
        {factoryMarkers.map((marker) => (
          <MapMarker
            key={marker.id}
            $tone={marker.tone}
            $x={marker.x}
            $y={marker.y}
          >
            {marker.label}
          </MapMarker>
        ))}
        <MapTools>
          <MapTool>+</MapTool>
          <MapTool>-</MapTool>
          <MapTool>◎</MapTool>
        </MapTools>
        <MapLegend>
          <MapLegendItem $tone="blue">人员</MapLegendItem>
          <MapLegendItem $tone="green">设备</MapLegendItem>
          <MapLegendItem $tone="red">告警</MapLegendItem>
          <MapLegendItem $tone="orange">风险区域</MapLegendItem>
        </MapLegend>
      </FactoryMap>
    </DashboardSection>
  );
}

function RealtimeAlarmCard({ total, items, hasError }) {
  const displayItems = items.length > 0 ? items : fallbackAlarmItems;

  return (
    <DashboardSection title="实时告警" action="查看更多">
      <AlarmSummary>
        今日累计 {total ?? "--"} 条{hasError ? " / 使用占位数据" : ""}
      </AlarmSummary>
      <AlarmList>
        {displayItems.map((item) => (
          <AlarmRow key={`${item.title}-${item.time}`}>
            <AlarmIcon $tone={item.tone}>
              <Icon id="Siren" size={16} strokeWidth={2} />
            </AlarmIcon>
            <AlarmContent>
              <AlarmTitle>{item.title}</AlarmTitle>
              <AlarmMeta>{item.meta}</AlarmMeta>
            </AlarmContent>
            <AlarmLevel $tone={item.tone}>{item.level}</AlarmLevel>
            <AlarmTime>{item.time}</AlarmTime>
          </AlarmRow>
        ))}
      </AlarmList>
    </DashboardSection>
  );
}

function MultiLineChart({ lines }) {
  const width = 420;
  const height = 150;
  const padding = 18;
  const allValues = lines.flatMap((line) => line.values);
  const maxValue = Math.max(...allValues, 1);

  return (
    <ChartSvg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {[0, 1, 2, 3].map((row) => (
        <GridLine
          key={row}
          x1={padding}
          x2={width - padding}
          y1={padding + row * 34}
          y2={padding + row * 34}
        />
      ))}
      {lines.map((line) => {
        const points = line.values
          .map((value, index) => {
            const x =
              padding +
              (index / (line.values.length - 1)) * (width - padding * 2);
            const y =
              height -
              padding -
              (value / maxValue) * (height - padding * 2);
            return `${x},${y}`;
          })
          .join(" ");

        return (
          <polyline
            key={line.label}
            points={points}
            fill="none"
            stroke={line.color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </ChartSvg>
  );
}

function SingleLineChart({ values }) {
  const width = 420;
  const height = 150;
  const padding = 18;
  const minValue = 70;
  const maxValue = 100;
  const points = values
    .map((value, index) => {
      const x = padding + (index / (values.length - 1)) * (width - padding * 2);
      const y =
        height -
        padding -
        ((value - minValue) / (maxValue - minValue)) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <ChartSvg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {[70, 80, 90, 100].map((value) => {
        const y =
          height -
          padding -
          ((value - minValue) / (maxValue - minValue)) * (height - padding * 2);
        return (
          <GridLine key={value} x1={padding} x2={width - padding} y1={y} y2={y} />
        );
      })}
      <polyline
        points={points}
        fill="none"
        stroke={dashboardPalette.blue}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {values.map((value, index) => {
        const x = padding + (index / (values.length - 1)) * (width - padding * 2);
        const y =
          height -
          padding -
          ((value - minValue) / (maxValue - minValue)) * (height - padding * 2);

        return <ChartDot key={`${value}-${index}`} cx={x} cy={y} r="4" />;
      })}
    </ChartSvg>
  );
}

function AlarmTrendCard() {
  return (
    <DashboardSection
      title="告警趋势分析"
      action={
        <SmallFilters>
          <SmallFilter>近7天</SmallFilter>
          <SmallFilter>按日</SmallFilter>
        </SmallFilters>
      }
    >
      <ChartLegend>
        {alarmTrendLines.map((line) => (
          <ChartLegendItem key={line.label} $color={line.color}>
            {line.label}
          </ChartLegendItem>
        ))}
      </ChartLegend>
      <MultiLineChart lines={alarmTrendLines} />
      <ChartAxis>
        {trendDays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </ChartAxis>
    </DashboardSection>
  );
}

function HealthHeatmapCard() {
  return (
    <DashboardSection
      title="人员健康分析"
      action={
        <SmallFilters>
          <SmallFilter>近7天</SmallFilter>
          <SmallFilter>按日</SmallFilter>
        </SmallFilters>
      }
    >
      <Heatmap>
        {heatmapRows.map((row, rowIndex) => (
          <React.Fragment key={row}>
            <HeatmapLabel>{row}</HeatmapLabel>
            {heatmapValues[rowIndex].map((value, colIndex) => (
              <HeatmapCell
                key={`${row}-${trendDays[colIndex]}`}
                $strength={value}
              />
            ))}
          </React.Fragment>
        ))}
      </Heatmap>
      <ChartAxis>
        {trendDays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </ChartAxis>
    </DashboardSection>
  );
}

function DeviceOnlineTrendCard({ currentRate }) {
  const values = [...onlineRateTrend.slice(0, -1), Number(currentRate ?? 93)];

  return (
    <DashboardSection
      title="设备在线率趋势"
      action={
        <SmallFilters>
          <SmallFilter>近7天</SmallFilter>
          <SmallFilter>按日</SmallFilter>
        </SmallFilters>
      }
    >
      <SingleLineChart values={values} />
      <ChartAxis>
        {trendDays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </ChartAxis>
    </DashboardSection>
  );
}

function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [realtimeAlarms, setRealtimeAlarms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [alarmHasError, setAlarmHasError] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadMetrics() {
      try {
        setHasError(false);
        const response = await fetch(`${API_BASE_URL}/dashboard/metrics`);

        if (!response.ok) {
          throw new Error("Failed to load dashboard metrics");
        }

        const data = await response.json();

        if (!ignore) {
          setMetrics(data);
        }
      } catch {
        if (!ignore) {
          setHasError(true);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    async function loadRealtimeAlarms() {
      try {
        setAlarmHasError(false);
        const response = await fetch(
          `${API_BASE_URL}/dashboard/realtime-alarms?limit=5`
        );

        if (!response.ok) {
          throw new Error("Failed to load realtime alarms");
        }

        const data = await response.json();

        if (!ignore) {
          setRealtimeAlarms((data.items ?? []).map(normalizeRealtimeAlarm));
        }
      } catch {
        if (!ignore) {
          setAlarmHasError(true);
        }
      }
    }

    loadMetrics();
    loadRealtimeAlarms();
    const intervalId = window.setInterval(() => {
      loadMetrics();
      loadRealtimeAlarms();
    }, 30000);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <Wrapper>
      <CardGrid>
        {metricCards.map((card) => (
          <Card
            key={card.key}
            {...card}
            value={metrics?.[card.key]}
            isLoading={isLoading}
            hasError={hasError}
          />
        ))}
      </CardGrid>

      <DashboardGrid>
        <DistributionStack>
          <DistributionCard
            title="人员状态分布"
            distribution={metrics?.person_status_distribution}
            config={personStatusConfig}
            unit="人"
            isLoading={isLoading}
            hasError={hasError}
          />
          <DistributionCard
            title="设备状态分布"
            distribution={metrics?.device_status_distribution}
            config={deviceStatusConfig}
            unit="台"
            isLoading={isLoading}
            hasError={hasError}
          />
        </DistributionStack>
        <FactoryMapCard />
        <RealtimeAlarmCard
          total={metrics?.today_alarm_count}
          items={realtimeAlarms}
          hasError={alarmHasError}
        />
      </DashboardGrid>

      <BottomGrid>
        <AlarmTrendCard />
        <HealthHeatmapCard />
        <DeviceOnlineTrendCard currentRate={metrics?.device_online_rate} />
      </BottomGrid>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: 88px minmax(0, 1fr) 174px;
  gap: 8px;
  overflow: hidden;
  background-color: hsl(0 0% 97.5%);
  padding: 8px;

  @media (max-height: 780px) {
    grid-template-rows: 80px minmax(0, 1fr) 158px;
  }
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;

  @media (max-width: 1180px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const CardWrapper = styled.article`
  min-height: 0;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  grid-template-rows: auto auto auto;
  column-gap: 12px;
  align-content: center;
  border: 1px solid hsl(220 13% 90%);
  border-radius: 8px;
  background: hsl(0 0% 100%);
  padding: 10px 16px;
`;

const CardTopLine = styled.div`
  display: contents;
`;

const CardTitle = styled.p`
  grid-column: 2;
  align-self: end;
  font-size: ${13 / 16}rem;
  font-weight: 500;
`;

const IconBadge = styled.div`
  width: 34px;
  height: 34px;
  grid-column: 1;
  grid-row: 1 / 4;
  align-self: center;
  border-radius: 100%;
  display: grid;
  place-items: center;
  color: white;
  background: ${(p) => toneColors[p.$tone].text};
`;

const MetricLine = styled.div`
  grid-column: 2;
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 4px;
`;

const MetricValue = styled.div`
  color: ${COLORS.gray10};
  font-family: var(--font-data);
  font-size: ${27 / 16}rem;
  font-weight: 650;
`;

const MetricUnit = styled.div`
  color: hsl(218 10% 45%);
  font-size: ${13 / 16}rem;
`;

const MetricFooter = styled.div`
  grid-column: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  color: hsl(218 10% 58%);
  font-size: ${12 / 16}rem;
`;

const MetricDelta = styled.span`
  color: ${(p) => toneColors[p.$tone].text};
  font-family: var(--font-data);
  font-weight: 700;
`;

const MetricLabel = styled.span`
  color: hsl(218 10% 58%);
`;

const DashboardGrid = styled.div`
  min-height: 0;
  display: grid;
  grid-template-columns: 250px minmax(420px, 1fr) minmax(292px, 340px);
  gap: 8px;
  align-items: stretch;

  @media (max-width: 1280px) {
    grid-template-columns: 250px minmax(0, 1fr);

    & > article:last-child {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 860px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const DistributionStack = styled.div`
  min-height: 0;
  display: grid;
  gap: 8px;
  grid-template-rows: repeat(2, minmax(0, 1fr));
`;

const DistributionWrapper = styled.article`
  min-height: 0;
  border: 1px solid hsl(220 13% 90%);
  border-radius: 8px;
  background: hsl(0 0% 100%);
  padding: 12px 14px;
  overflow: hidden;
`;

const DistributionTitle = styled.h2`
  color: ${COLORS.gray10};
  font-size: ${14 / 16}rem;
  font-weight: 650;
`;

const DistributionBody = styled.div`
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  margin-top: 10px;
`;

const DonutFrame = styled.div`
  width: 96px;
  height: 96px;
  display: grid;
  place-items: center;
`;

const DonutSvg = styled.svg`
  display: block;
`;

const LegendList = styled.ul`
  display: grid;
  gap: 7px;
  min-width: 0;
`;

const LegendItem = styled.li`
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
`;

const LegendDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 100%;
  background: ${(p) => p.$color};
`;

const LegendText = styled.div`
  min-width: 0;
`;

const LegendLabel = styled.div`
  color: hsl(218 10% 30%);
  font-size: ${12 / 16}rem;
  line-height: 1.25;
`;

const LegendValue = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 2px;
  color: ${COLORS.gray10};
  font-family: var(--font-data);
  font-size: ${13 / 16}rem;
  font-weight: 650;
`;

const LegendRatio = styled.span`
  color: hsl(218 10% 50%);
  font-size: ${11 / 16}rem;
  font-weight: 500;
`;

const Panel = styled.article`
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid hsl(220 13% 90%);
  border-radius: 8px;
  background: hsl(0 0% 100%);
  padding: 12px 14px;
  overflow: hidden;
`;

const PanelHeader = styled.div`
  min-height: 24px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const PanelTitle = styled.h2`
  color: ${COLORS.gray10};
  font-size: ${14 / 16}rem;
  font-weight: 650;
`;

const PanelAction = styled.div`
  color: ${dashboardPalette.blue};
  font-size: ${12 / 16}rem;
  font-weight: 600;
`;

const MapToggles = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: hsl(218 10% 45%);
`;

const TogglePill = styled.span`
  position: relative;
  padding-left: 16px;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: ${dashboardPalette.blue};
    transform: translateY(-50%);
  }
`;

const FactoryMap = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  margin-top: 8px;
  border: 1px solid hsl(214 34% 84%);
  border-radius: 6px;
  overflow: hidden;
  background:
    linear-gradient(135deg, hsl(211 60% 95% / 0.8), hsl(210 30% 99% / 0.9)),
    repeating-linear-gradient(
      30deg,
      transparent 0 16px,
      hsl(214 56% 78% / 0.38) 17px 19px
    ),
    repeating-linear-gradient(
      90deg,
      hsl(212 24% 88% / 0.55) 0 6px,
      transparent 7px 24px
    );
`;

const MapZone = styled.div`
  position: absolute;
  left: ${(p) => p.$left}%;
  top: ${(p) => p.$top}%;
  width: ${(p) => p.$width}%;
  height: ${(p) => p.$height}%;
  display: grid;
  place-items: center;
  border: 1px solid ${(p) => mapToneColors[p.$tone].text};
  border-radius: 16px;
  color: ${(p) => mapToneColors[p.$tone].text};
  background: ${(p) => mapToneColors[p.$tone].background};
  font-size: ${12 / 16}rem;
  font-weight: 700;
`;

const MapMarker = styled.div`
  position: absolute;
  left: ${(p) => p.$x}%;
  top: ${(p) => p.$y}%;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: 2px solid white;
  border-radius: 100%;
  color: white;
  background: ${(p) => mapToneColors[p.$tone].text};
  box-shadow: 0 6px 14px hsl(220 20% 20% / 0.16);
  font-size: ${11 / 16}rem;
  font-weight: 700;
  transform: translate(-50%, -50%);
`;

const MapTools = styled.div`
  position: absolute;
  right: 14px;
  top: 48px;
  display: grid;
  overflow: hidden;
  border: 1px solid hsl(220 13% 88%);
  border-radius: 6px;
  background: white;
`;

const MapTool = styled.button`
  width: 30px;
  height: 30px;
  border: 0;
  border-bottom: 1px solid hsl(220 13% 90%);
  background: white;
  color: hsl(218 12% 25%);
  font-size: ${18 / 16}rem;
  font-weight: 700;
`;

const MapLegend = styled.div`
  position: absolute;
  left: 18px;
  bottom: 14px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  border: 1px solid hsl(220 13% 90%);
  border-radius: 6px;
  background: hsl(0 0% 100% / 0.84);
  backdrop-filter: blur(6px);
`;

const MapLegendItem = styled.span`
  position: relative;
  padding-left: 16px;
  color: hsl(218 10% 35%);
  font-size: ${12 / 16}rem;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: 9px;
    height: 9px;
    border-radius: 100%;
    background: ${(p) => mapToneColors[p.$tone].text};
    transform: translateY(-50%);
  }
`;

const AlarmSummary = styled.p`
  margin-top: 2px;
  color: hsl(218 10% 48%);
  font-size: ${12 / 16}rem;
`;

const AlarmList = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  margin-top: 8px;
  align-content: stretch;
`;

const AlarmRow = styled.div`
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) 42px 52px;
  align-items: center;
  gap: 7px;
  min-height: 0;
  border-bottom: 1px solid hsl(220 13% 92%);
`;

const AlarmIcon = styled.div`
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 100%;
  color: ${(p) => mapToneColors[p.$tone].text};
  background: ${(p) => mapToneColors[p.$tone].background};
`;

const AlarmContent = styled.div`
  min-width: 0;
`;

const AlarmTitle = styled.div`
  color: ${COLORS.gray10};
  font-size: ${12 / 16}rem;
  font-weight: 650;
`;

const AlarmMeta = styled.div`
  margin-top: 2px;
  color: hsl(218 10% 55%);
  font-size: ${12 / 16}rem;
`;

const AlarmLevel = styled.span`
  justify-self: start;
  border-radius: 5px;
  padding: 3px 7px;
  color: ${(p) => mapToneColors[p.$tone].text};
  background: ${(p) => mapToneColors[p.$tone].background};
  font-size: ${12 / 16}rem;
  font-weight: 700;
`;

const AlarmTime = styled.span`
  color: hsl(218 10% 55%);
  font-family: var(--font-data);
  font-size: ${12 / 16}rem;
`;

const BottomGrid = styled.div`
  min-height: 0;
  display: grid;
  grid-template-columns: 1.05fr 1.05fr 1.15fr;
  gap: 8px;

  ${Panel} {
    min-height: 0;
  }

  @media (max-width: 1180px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const SmallFilters = styled.div`
  display: flex;
  gap: 8px;
`;

const SmallFilter = styled.span`
  min-width: 58px;
  border: 1px solid hsl(220 13% 88%);
  border-radius: 6px;
  padding: 5px 8px;
  color: hsl(218 10% 45%);
  background: hsl(0 0% 100%);
  text-align: center;
  font-size: ${12 / 16}rem;
  font-weight: 500;
`;

const ChartLegend = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 0;
`;

const ChartLegendItem = styled.span`
  position: relative;
  padding-left: 14px;
  color: hsl(218 10% 42%);
  font-size: ${12 / 16}rem;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: 9px;
    height: 3px;
    border-radius: 999px;
    background: ${(p) => p.$color};
    transform: translateY(-50%);
  }
`;

const ChartSvg = styled.svg`
  width: 100%;
  height: 108px;
  margin-top: 4px;
  overflow: visible;

  @media (max-height: 780px) {
    height: 92px;
  }
`;

const GridLine = styled.line`
  stroke: hsl(220 13% 90%);
  stroke-width: 1;
  stroke-dasharray: 4 5;
`;

const ChartDot = styled.circle`
  fill: ${dashboardPalette.blue};
  stroke: white;
  stroke-width: 2;
`;

const ChartAxis = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  color: hsl(218 10% 55%);
  font-family: var(--font-data);
  font-size: ${11 / 16}rem;
  text-align: center;
`;

const Heatmap = styled.div`
  display: grid;
  grid-template-columns: 82px repeat(7, minmax(0, 1fr));
  gap: 4px;
  margin-top: 14px;
`;

const HeatmapLabel = styled.div`
  color: hsl(218 10% 42%);
  font-size: ${12 / 16}rem;
  line-height: 19px;
`;

const HeatmapCell = styled.div`
  height: 19px;
  border-radius: 3px;
  background: hsl(214 92% ${(p) => 96 - p.$strength * 0.44}%);
`;

const toneColors = {
  blue: {
    text: dashboardPalette.blue,
    background: dashboardPalette.softBlue,
  },
  green: {
    text: dashboardPalette.green,
    background: dashboardPalette.softGreen,
  },
  amber: {
    text: dashboardPalette.orange,
    background: dashboardPalette.softOrange,
  },
  red: {
    text: dashboardPalette.red,
    background: dashboardPalette.softRed,
  },
};

const mapToneColors = {
  blue: toneColors.blue,
  green: toneColors.green,
  orange: toneColors.amber,
  amber: {
    text: "hsl(43 92% 58%)",
    background: "hsl(43 92% 58% / 0.14)",
  },
  red: toneColors.red,
};

export default Dashboard;
