import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import Icon from "../components/Icon/Icon";
import { COLORS, FONT_SIZES } from "../constants/STYLES";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

const ALARM_PAGE_SIZE = 5;

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

function getAlarmTone(level) {
  if (["重大", "高"].includes(level)) {
    return "red";
  }

  if (["严重", "中等", "中", "较高"].includes(level)) {
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
  const meta =
    item.meta ??
    [item.person_name, item.department].filter(Boolean).join(" / ");

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

function formatTrendDay(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  })
    .format(date)
    .replace("/", "-");
}

const trendDays = Array.from({ length: 7 }, (_, index) => {
  const date = new Date();
  date.setDate(date.getDate() - (6 - index));
  return formatTrendDay(date);
});

function buildAlarmTrendLines(items) {
  return [
    {
      label: "重大",
      color: dashboardPalette.red,
      values: items.map((item) => Number(item.major ?? 0)),
    },
    {
      label: "严重",
      color: dashboardPalette.orange,
      values: items.map((item) => Number(item.severe ?? 0)),
    },
    {
      label: "一般",
      color: "hsl(43 92% 58%)",
      values: items.map((item) => Number(item.general ?? 0)),
    },
  ];
}
const onlineRateTrend = [94, 93, 95, 92.5, 94.5, 93, 93];
const heatmapRows = [
  "罐区A",
  "罐区B",
  "催化裂化区",
  "加氢装置区",
  "常减压装置区",
];
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
        <MetricDelta $tone={tone}>
          {tone === "red" ? "+1" : "+1.2%"}
        </MetricDelta>
        <MetricLabel>{hasError ? "数据获取失败" : "较昨日"}</MetricLabel>
      </MetricFooter>
    </CardWrapper>
  );
}

function DonutChart({ items, shouldShowValue }) {
  const size = 112;
  const strokeWidth = 15;
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
        fontSize={FONT_SIZES.dashboardDonutCenterLabel}
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
        fontSize={FONT_SIZES.dashboardDonutCenterValue}
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
              <LegendLabel>{item.label}</LegendLabel>
              <LegendValue>
                {shouldShowValue ? `${item.count}${unit}` : "--"}
              </LegendValue>
              <LegendRatio>
                {shouldShowValue ? `${item.ratio}%` : "--"}
              </LegendRatio>
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

function ChartPanelBody({ children }) {
  return <ChartPanelContent>{children}</ChartPanelContent>;
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

function RealtimeAlarmCard({ total, items, hasError, isLoading }) {
  const displayItems = items;
  const [currentPage, setCurrentPage] = useState(0);
  const pageCount = Math.max(
    1,
    Math.ceil(displayItems.length / ALARM_PAGE_SIZE)
  );
  const normalizedPage = Math.min(currentPage, pageCount - 1);
  const visiblePageStart = Math.min(
    Math.max(normalizedPage - 1, 0),
    Math.max(pageCount - 4, 0)
  );
  const visiblePages = Array.from(
    { length: Math.min(pageCount, 4) },
    (_, index) => visiblePageStart + index
  );
  const pageItems = displayItems.slice(
    normalizedPage * ALARM_PAGE_SIZE,
    normalizedPage * ALARM_PAGE_SIZE + ALARM_PAGE_SIZE
  );
  const fixedRows = Array.from(
    { length: ALARM_PAGE_SIZE },
    (_, index) => pageItems[index] ?? null
  );
  const alarmStatusMessage = isLoading
    ? "实时告警加载中"
    : hasError
    ? "实时告警加载失败"
    : displayItems.length === 0
    ? "暂无实时告警"
    : "";

  useEffect(() => {
    setCurrentPage(0);
  }, [items.length, hasError]);

  return (
    <DashboardSection title="实时告警" action="查看更多">
      <AlarmSummary>今日累计 {total ?? "--"} 条</AlarmSummary>
      <AlarmList>
        {alarmStatusMessage ? (
          <AlarmStatusMessage>{alarmStatusMessage}</AlarmStatusMessage>
        ) : null}
        {fixedRows.map((item, index) => (
          <AlarmRow
            key={
              item
                ? `${normalizedPage}-${item.title}-${item.time}`
                : `empty-${index}`
            }
            $isEmpty={!item}
          >
            {item ? (
              <>
                <AlarmIcon $tone={item.tone}>
                  <Icon id="Siren" size={16} strokeWidth={2} />
                </AlarmIcon>
                <AlarmContent>
                  <AlarmTitle>{item.title}</AlarmTitle>
                  <AlarmMeta>{item.meta}</AlarmMeta>
                </AlarmContent>
                <AlarmLevel $tone={item.tone}>{item.level}</AlarmLevel>
                <AlarmTime>{item.time}</AlarmTime>
              </>
            ) : null}
          </AlarmRow>
        ))}
      </AlarmList>
      <AlarmPagination>
        {pageCount === 1 ? (
          <PageButton type="button" disabled>
            ‹
          </PageButton>
        ) : null}
        {pageCount > 1 ? (
          <PageButton
            type="button"
            disabled={normalizedPage === 0}
            onClick={() => setCurrentPage((page) => Math.max(page - 1, 0))}
          >
            ‹
          </PageButton>
        ) : null}
        {visiblePages.map((page) => (
          <PageButton
            key={page}
            type="button"
            $isActive={page === normalizedPage}
            onClick={() => setCurrentPage(page)}
          >
            {page + 1}
          </PageButton>
        ))}
        {pageCount > 1 ? (
          <PageButton
            type="button"
            disabled={normalizedPage >= pageCount - 1}
            onClick={() =>
              setCurrentPage((page) => Math.min(page + 1, pageCount - 1))
            }
          >
            ›
          </PageButton>
        ) : null}
        {pageCount === 1 ? (
          <PageButton type="button" disabled>
            ›
          </PageButton>
        ) : null}
      </AlarmPagination>
    </DashboardSection>
  );
}

function buildSmoothPath(points) {
  if (points.length === 0) {
    return "";
  }

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX},${previous.y} ${controlX},${point.y} ${point.x},${point.y}`;
  }, `M ${points[0].x},${points[0].y}`);
}

function MultiLineChart({ lines }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const width = 420;
  const height = 150;
  const padding = { top: 8, right: 8, bottom: 6, left: 30 };
  const allValues = lines.flatMap((line) => line.values);
  const maxValue = Math.max(...allValues, 0);
  const tickStep = Math.max(1, Math.ceil(maxValue / 4));
  const axisMax = tickStep * 4;
  const tickValues = Array.from({ length: 5 }, (_, index) => index * tickStep);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const getX = (index, count) =>
    padding.left + ((index + 0.5) / Math.max(count, 1)) * plotWidth;
  const getY = (value) =>
    height - padding.bottom - (value / axisMax) * plotHeight;

  const tooltipWidth = 72;
  const tooltipX = hoveredPoint
    ? Math.min(
        Math.max(hoveredPoint.x - tooltipWidth / 2, padding.left),
        width - padding.right - tooltipWidth
      )
    : 0;
  const tooltipY = hoveredPoint
    ? Math.max(hoveredPoint.y - 32, padding.top)
    : 0;

  return (
    <ChartSvg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="最近7天告警等级趋势曲线"
      onMouseLeave={() => setHoveredPoint(null)}
    >
      {tickValues.map((value) => {
        const y = getY(value);

        return (
          <React.Fragment key={value}>
            <GridLine
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
            />
            <ChartYAxisLabel x={padding.left - 7} y={y + 3}>
              {value}
            </ChartYAxisLabel>
          </React.Fragment>
        );
      })}
      <ChartYAxis
        x1={padding.left}
        x2={padding.left}
        y1={padding.top}
        y2={height - padding.bottom}
      />
      {lines.map((line) => {
        const points = line.values.map((value, index) => ({
          x: getX(index, line.values.length),
          y: getY(value),
          value,
        }));

        return (
          <React.Fragment key={line.label}>
            <ChartCurve
              d={buildSmoothPath(points)}
              fill="none"
              stroke={line.color}
            />
            {points.map((point, index) => (
              <TrendPoint
                key={`${line.label}-${index}`}
                cx={point.x}
                cy={point.y}
                r={
                  hoveredPoint?.line === line.label &&
                  hoveredPoint?.index === index
                    ? 5
                    : 3.5
                }
                fill={line.color}
                tabIndex="0"
                onMouseEnter={() =>
                  setHoveredPoint({ ...point, line: line.label, index })
                }
                onFocus={() =>
                  setHoveredPoint({ ...point, line: line.label, index })
                }
                onBlur={() => setHoveredPoint(null)}
              >
                <title>{`${line.label}：${point.value} 条`}</title>
              </TrendPoint>
            ))}
          </React.Fragment>
        );
      })}
      {hoveredPoint ? (
        <ChartTooltip transform={`translate(${tooltipX} ${tooltipY})`}>
          <rect width={tooltipWidth} height="24" rx="5" />
          <text x={tooltipWidth / 2} y="16">
            {hoveredPoint.line} {hoveredPoint.value} 条
          </text>
        </ChartTooltip>
      ) : null}
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
          <GridLine
            key={value}
            x1={padding}
            x2={width - padding}
            y1={y}
            y2={y}
          />
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
        const x =
          padding + (index / (values.length - 1)) * (width - padding * 2);
        const y =
          height -
          padding -
          ((value - minValue) / (maxValue - minValue)) * (height - padding * 2);

        return <ChartDot key={`${value}-${index}`} cx={x} cy={y} r="4" />;
      })}
    </ChartSvg>
  );
}

function AlarmTrendCard({ items, isLoading, hasError }) {
  const lines = buildAlarmTrendLines(items);
  const days = items.map((item) => formatTrendDay(`${item.date}T00:00:00+08:00`));
  const statusMessage = isLoading
    ? "告警趋势加载中..."
    : hasError
      ? "告警趋势加载失败"
      : items.length === 0
        ? "近7天暂无告警数据"
        : null;

  return (
    <DashboardSection
      title="告警趋势分析"
      action={
        <SmallFilters>
          <TrendFilterSelect aria-label="时间范围" defaultValue="last7">
            <option value="last7">近7天</option>
          </TrendFilterSelect>
          <TrendFilterSelect aria-label="聚合粒度" defaultValue="day">
            <option value="day">按日</option>
          </TrendFilterSelect>
        </SmallFilters>
      }
    >
      <ChartPanelBody>
        <ChartLegend>
          {lines.map((line) => (
            <ChartLegendItem key={line.label} $color={line.color}>
              {line.label}
            </ChartLegendItem>
          ))}
        </ChartLegend>
        <ChartCanvas>
          {statusMessage ? (
            <ChartStatusMessage>{statusMessage}</ChartStatusMessage>
          ) : (
            <MultiLineChart lines={lines} />
          )}
        </ChartCanvas>
        <AlarmChartAxis>
          {days.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </AlarmChartAxis>
      </ChartPanelBody>
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
      <ChartPanelBody>
        <ChartSpacer aria-hidden="true" />
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
      </ChartPanelBody>
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
      <ChartPanelBody>
        <ChartCanvas>
          <SingleLineChart values={values} />
        </ChartCanvas>
        <ChartAxis>
          {trendDays.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </ChartAxis>
      </ChartPanelBody>
    </DashboardSection>
  );
}

function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [realtimeAlarms, setRealtimeAlarms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [alarmHasError, setAlarmHasError] = useState(false);
  const [isAlarmLoading, setIsAlarmLoading] = useState(true);
  const [alarmTrend, setAlarmTrend] = useState([]);
  const [alarmTrendHasError, setAlarmTrendHasError] = useState(false);
  const [isAlarmTrendLoading, setIsAlarmTrendLoading] = useState(true);

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
        setIsAlarmLoading(true);
        setAlarmHasError(false);
        const response = await fetch(
          `${API_BASE_URL}/dashboard/realtime-alarms?limit=20`
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
      } finally {
        if (!ignore) {
          setIsAlarmLoading(false);
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

  useEffect(() => {
    let ignore = false;

    async function loadLastSevenDaysAlarmTrend() {
      try {
        setIsAlarmTrendLoading(true);
        setAlarmTrendHasError(false);
        const response = await fetch(
          `${API_BASE_URL}/dashboard/alarm-trend?days=7&granularity=day`
        );

        if (!response.ok) {
          throw new Error("Failed to load the last seven days alarm trend");
        }

        const data = await response.json();

        if (!ignore) {
          setAlarmTrend(data.items ?? []);
        }
      } catch {
        if (!ignore) {
          setAlarmTrendHasError(true);
        }
      } finally {
        if (!ignore) {
          setIsAlarmTrendLoading(false);
        }
      }
    }

    loadLastSevenDaysAlarmTrend();
    const intervalId = window.setInterval(loadLastSevenDaysAlarmTrend, 30000);

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
          isLoading={isAlarmLoading}
        />
      </DashboardGrid>

      <BottomGrid>
        <AlarmTrendCard
          items={alarmTrend}
          isLoading={isAlarmTrendLoading}
          hasError={alarmTrendHasError}
        />
        <HealthHeatmapCard />
        <DeviceOnlineTrendCard currentRate={metrics?.device_online_rate} />
      </BottomGrid>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: 84px minmax(0, 1fr) 232px;
  gap: 8px;
  overflow: hidden;
  background-color: hsl(0 0% 97.5%);
  padding: 8px;

  @media (max-height: 780px) {
    grid-template-rows: 80px minmax(0, 1fr) 200px;
  }

  @media (max-width: 1280px) {
    height: auto;
    min-height: 100%;
    grid-template-rows: auto auto auto;
    overflow: visible;
  }
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  grid-auto-rows: 84px;

  @media (max-width: 1180px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 760px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const CardWrapper = styled.article`
  min-height: 0;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  grid-template-rows: auto auto auto;
  column-gap: 12px;
  row-gap: 0;
  align-content: center;
  border: 1px solid hsl(220 13% 90%);
  border-radius: 8px;
  background: hsl(0 0% 100%);
  padding: 10px 18px;
`;

const CardTopLine = styled.div`
  display: contents;
`;

const CardTitle = styled.p`
  grid-column: 2;
  align-self: end;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: hsl(218 15% 20%);
  font-size: ${FONT_SIZES.dashboardMetricTitle};
  font-weight: 600;
`;

const IconBadge = styled.div`
  width: 36px;
  height: 36px;
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
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 0;
`;

const MetricValue = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${COLORS.gray10};
  font-family: var(--font-data);
  font-size: ${FONT_SIZES.dashboardMetricValue};
  line-height: 1.03;
  font-weight: 650;
`;

const MetricUnit = styled.div`
  color: hsl(218 10% 45%);
  font-size: ${FONT_SIZES.dashboardMetricUnit};
`;

const MetricFooter = styled.div`
  grid-column: 2;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 0;
  color: hsl(218 10% 58%);
  font-size: ${FONT_SIZES.dashboardMetricMeta};
`;

const MetricDelta = styled.span`
  color: ${(p) => toneColors[p.$tone].text};
  font-family: var(--font-data);
  font-weight: 700;
`;

const MetricLabel = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: hsl(218 10% 58%);
`;

const DashboardGrid = styled.div`
  min-height: 0;
  display: grid;
  grid-template-columns:
    clamp(280px, 17vw, 320px)
    minmax(0, 1fr)
    clamp(340px, 22vw, 420px);
  gap: 8px;
  align-items: stretch;

  @media (max-width: 1280px) {
    grid-template-columns: clamp(280px, 31vw, 320px) minmax(0, 1fr);
    grid-auto-rows: auto;

    & > article:last-child {
      grid-column: 1 / -1;
      min-height: 356px;
    }
  }

  @media (max-width: 980px) {
    grid-template-columns: minmax(0, 1fr);

    & > article {
      min-height: 420px;
    }

    & > article:last-child {
      grid-column: auto;
      min-height: 356px;
    }
  }
`;

const DistributionStack = styled.div`
  min-height: 0;
  display: grid;
  gap: 8px;
  grid-template-rows: repeat(2, minmax(0, 1fr));

  @media (max-width: 1280px) {
    height: 501px;
  }

  @media (max-width: 980px) {
    height: auto;
    grid-template-columns: repeat(2, minmax(280px, 1fr));
    grid-template-rows: 247px;
  }

  @media (max-width: 760px) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: repeat(2, 247px);
  }
`;

const DistributionWrapper = styled.article`
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border: 1px solid hsl(220 13% 90%);
  border-radius: 8px;
  background: hsl(0 0% 100%);
  padding: 14px 18px;
  overflow: hidden;
`;

const DistributionTitle = styled.h2`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.dashboardCardTitle};
  font-weight: 650;
`;

const DistributionBody = styled.div`
  min-height: 0;
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  margin-top: 14px;
`;

const DonutFrame = styled.div`
  width: 112px;
  height: 112px;
  display: grid;
  place-items: center;
`;

const DonutSvg = styled.svg`
  display: block;
`;

const LegendList = styled.ul`
  min-height: 0;
  display: grid;
  gap: 9px;
  align-content: center;
  min-width: 0;
`;

const LegendItem = styled.li`
  display: grid;
  grid-template-columns: 8px minmax(36px, 1fr) 24px 42px;
  align-items: center;
  gap: 7px;
  min-width: 0;
`;

const LegendDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 100%;
  background: ${(p) => p.$color};
`;

const LegendLabel = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: hsl(218 10% 30%);
  font-size: ${FONT_SIZES.dashboardLegendLabel};
  line-height: 1.1;
`;

const LegendValue = styled.div`
  min-width: 0;
  justify-self: start;
  text-align: left;
  white-space: nowrap;
  color: ${COLORS.gray10};
  font-family: var(--font-data);
  font-size: ${FONT_SIZES.dashboardLegendValue};
  font-weight: 600;
  line-height: 1;
`;

const LegendRatio = styled.span`
  flex: 0 0 auto;
  justify-self: start;
  text-align: left;
  white-space: nowrap;
  color: hsl(218 10% 50%);
  font-size: ${FONT_SIZES.dashboardLegendRatio};
  font-weight: 500;
`;

const Panel = styled.article`
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid hsl(220 13% 90%);
  border-radius: 8px;
  background: hsl(0 0% 100%);
  padding: 14px 16px;
  overflow: hidden;
`;

const PanelHeader = styled.div`
  min-height: 28px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
`;

const PanelTitle = styled.h2`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.dashboardPanelTitle};
  font-weight: 650;
`;

const PanelAction = styled.div`
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  color: ${dashboardPalette.blue};
  font-size: ${FONT_SIZES.dashboardPanelAction};
  font-weight: 600;
`;

const MapToggles = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  color: hsl(218 10% 45%);
`;

const TogglePill = styled.span`
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  position: relative;
  padding-left: 14px;

  &::before {
    content: "✓";
    position: absolute;
    left: 0;
    top: 50%;
    width: 11px;
    height: 11px;
    border-radius: 3px;
    display: grid;
    place-items: center;
    background: ${dashboardPalette.blue};
    color: white;
    font-size: ${FONT_SIZES.dashboardCheckMark};
    line-height: 1;
    transform: translateY(-50%);
  }
`;

const FactoryMap = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  margin-top: 10px;
  border: 1px solid hsl(214 34% 84%);
  border-radius: 6px;
  overflow: hidden;
  background: linear-gradient(
      135deg,
      hsl(211 60% 95% / 0.8),
      hsl(210 30% 99% / 0.9)
    ),
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
  overflow: hidden;
  padding: 0 6px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: ${FONT_SIZES.dashboardMapLabel};
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
  font-size: ${FONT_SIZES.dashboardMapMarker};
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
  font-size: ${FONT_SIZES.dashboardMapTool};
  font-weight: 700;
`;

const MapLegend = styled.div`
  position: absolute;
  left: 18px;
  bottom: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: calc(100% - 36px);
  padding: 7px 10px;
  border: 1px solid hsl(220 13% 90%);
  border-radius: 6px;
  background: hsl(0 0% 100% / 0.84);
  backdrop-filter: blur(6px);
`;

const MapLegendItem = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  position: relative;
  padding-left: 16px;
  color: hsl(218 10% 35%);
  font-size: ${FONT_SIZES.dashboardMapLegend};

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
  flex: 0 0 auto;
  margin-top: 0;
  color: hsl(218 10% 48%);
  font-size: ${FONT_SIZES.dashboardAlarmSummary};
`;

const AlarmList = styled.div`
  position: relative;
  flex: 0 0 260px;
  min-height: 260px;
  display: grid;
  grid-template-rows: repeat(5, 52px);
  margin-top: 10px;
  overflow: hidden;
`;

const AlarmStatusMessage = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  color: hsl(218 10% 52%);
  font-size: ${FONT_SIZES.dashboardAlarmMeta};
  pointer-events: none;
`;

const AlarmRow = styled.div`
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 46px 66px;
  align-items: center;
  gap: 8px;
  height: 52px;
  border-bottom: 1px solid hsl(220 13% 92%);
  opacity: ${(p) => (p.$isEmpty ? 0 : 1)};
  pointer-events: ${(p) => (p.$isEmpty ? "none" : "auto")};
`;

const AlarmIcon = styled.div`
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 100%;
  color: ${(p) => mapToneColors[p.$tone].text};
  background: ${(p) => mapToneColors[p.$tone].background};
`;

const AlarmContent = styled.div`
  min-width: 0;
  overflow: hidden;
`;

const AlarmTitle = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.dashboardAlarmTitle};
  font-weight: 650;
`;

const AlarmMeta = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
  color: hsl(218 10% 55%);
  font-size: ${FONT_SIZES.dashboardAlarmMeta};
`;

const AlarmLevel = styled.span`
  justify-self: start;
  max-width: 46px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 5px;
  padding: 3px 7px;
  color: ${(p) => mapToneColors[p.$tone].text};
  background: ${(p) => mapToneColors[p.$tone].background};
  font-size: ${FONT_SIZES.dashboardAlarmBadge};
  font-weight: 700;
`;

const AlarmTime = styled.span`
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
  color: hsl(218 10% 55%);
  font-family: var(--font-data);
  font-size: ${FONT_SIZES.dashboardAlarmTime};
  justify-self: end;
`;

const AlarmPagination = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 6px;
  padding-top: 4px;
`;

const PageButton = styled.button`
  min-width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  display: grid;
  place-items: center;
  background: ${(p) => (p.$isActive ? dashboardPalette.blue : "transparent")};
  color: ${(p) =>
    p.$isActive
      ? "white"
      : p.disabled
      ? "hsl(218 10% 70%)"
      : "hsl(218 10% 42%)"};
  font-family: var(--font-data);
  font-size: ${FONT_SIZES.dashboardPageButton};
  font-weight: ${(p) => (p.$isActive ? 700 : 500)};
  cursor: ${(p) => (p.disabled ? "default" : "pointer")};

  &:hover:not(:disabled) {
    color: ${(p) => (p.$isActive ? "white" : dashboardPalette.blue)};
    background: ${(p) =>
      p.$isActive ? dashboardPalette.blue : dashboardPalette.softBlue};
  }
`;

const BottomGrid = styled.div`
  min-height: 0;
  display: grid;
  grid-template-columns: 1.05fr 1fr 1.08fr;
  gap: 8px;
  grid-auto-rows: minmax(0, 1fr);

  ${Panel} {
    min-height: 0;
  }

  @media (max-width: 1180px) {
    grid-template-columns: minmax(0, 1fr);
    grid-auto-rows: 232px;
  }
`;

const ChartPanelContent = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: 16px minmax(0, 1fr) 20px;
  row-gap: 8px;
  padding-top: 4px;
`;

const ChartSpacer = styled.div`
  min-height: 0;
`;

const SmallFilters = styled.div`
  display: flex;
  gap: 8px;
`;

const SmallFilter = styled.span`
  min-width: 50px;
  border: 1px solid hsl(220 13% 88%);
  border-radius: 6px;
  padding: 3px 8px;
  color: hsl(218 10% 45%);
  background: hsl(0 0% 100%);
  text-align: center;
  font-size: ${FONT_SIZES.dashboardFilter};
  font-weight: 500;
`;

const TrendFilterSelect = styled.select`
  min-width: 50px;
  border: 1px solid hsl(220 13% 82%);
  border-radius: 6px;
  padding: 3px 20px 3px 8px;
  color: hsl(218 10% 38%);
  background: hsl(0 0% 100%);
  text-align: center;
  font: inherit;
  font-size: ${FONT_SIZES.dashboardFilter};
  font-weight: 500;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${dashboardPalette.softBlue};
    outline-offset: 2px;
  }
`;

const ChartLegend = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 0;
  min-width: 0;
  overflow: hidden;
`;

const ChartLegendItem = styled.span`
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  position: relative;
  padding-left: 14px;
  color: hsl(218 10% 42%);
  font-size: ${FONT_SIZES.dashboardChartLegend};

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

const ChartCanvas = styled.div`
  min-height: 0;
  overflow: hidden;
`;

const ChartStatusMessage = styled.div`
  height: 100%;
  display: grid;
  place-items: center;
  color: hsl(218 10% 55%);
  font-size: ${FONT_SIZES.dashboardChartLegend};
`;

const ChartSvg = styled.svg`
  width: 100%;
  height: 100%;
  min-height: 0;
  display: block;
  overflow: hidden;
`;

const GridLine = styled.line`
  stroke: hsl(220 13% 90%);
  stroke-width: 1;
  stroke-dasharray: 4 5;
`;

const ChartYAxis = styled.line`
  stroke: hsl(220 13% 78%);
  stroke-width: 1;
`;

const ChartYAxisLabel = styled.text`
  fill: hsl(218 10% 52%);
  font-family: var(--font-data);
  font-size: ${FONT_SIZES.dashboardAxis};
  text-anchor: end;
`;

const ChartCurve = styled.path`
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
`;

const TrendPoint = styled.circle`
  stroke: white;
  stroke-width: 1.5;
  cursor: pointer;
  transition: r 120ms ease;

  &:focus {
    outline: none;
    stroke: hsl(214 92% 30%);
    stroke-width: 2;
  }
`;

const ChartTooltip = styled.g`
  pointer-events: none;

  rect {
    fill: hsl(220 22% 18% / 0.94);
  }

  text {
    fill: white;
    font-size: ${FONT_SIZES.dashboardAxis};
    text-anchor: middle;
  }
`;

const ChartDot = styled.circle`
  fill: ${dashboardPalette.blue};
  stroke: white;
  stroke-width: 2;
`;

const ChartAxis = styled.div`
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  color: hsl(218 10% 55%);
  font-family: var(--font-data);
  font-size: ${FONT_SIZES.dashboardAxis};
  align-items: end;
  text-align: center;
`;

const AlarmChartAxis = styled(ChartAxis)`
  box-sizing: border-box;
  padding-left: 7.1429%;
  padding-right: 1.9048%;
  gap: 0;
`;

const Heatmap = styled.div`
  min-height: 0;
  align-self: center;
  display: grid;
  grid-template-columns: 88px repeat(7, minmax(0, 1fr));
  gap: 4px;
`;

const HeatmapLabel = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: hsl(218 10% 42%);
  font-size: ${FONT_SIZES.dashboardHeatmapLabel};
  line-height: 20px;
`;

const HeatmapCell = styled.div`
  height: 20px;
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
