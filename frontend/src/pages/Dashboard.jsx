import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import styled from "styled-components";
import { Maximize2, X } from "lucide-react";
import BaiduSatelliteMap from "../components/BaiduSatelliteMap/BaiduSatelliteMap";
import Icon from "../components/Icon/Icon";
import MiniAreaSparkline from "../components/MiniAreaSparkline/MiniAreaSparkline";
import { API_BASE_URL } from "../config/api";
import { COLORS, FONT_SIZES } from "../constants/STYLES";
import { warmAlarmCenter } from "../services/alarmCenterCache";
import {
  getCachedJson,
  loadCachedJson,
  warmApplicationPages,
} from "../services/pageDataCache";

const ALARM_PAGE_SIZE = 5;
const DASHBOARD_URLS = {
  metrics: `${API_BASE_URL}/dashboard/metrics`,
  alarms: `${API_BASE_URL}/dashboard/realtime-alarms?limit=20`,
  alarmTrend: `${API_BASE_URL}/dashboard/alarm-trend?days=7&granularity=day`,
  personHealth: `${API_BASE_URL}/dashboard/person-health-analysis?days=7&granularity=day`,
  deviceTrend: `${API_BASE_URL}/dashboard/device-online-trend?days=7&granularity=day`,
};

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

const trendRangeOptions = [
  { value: 1, label: "近1天" },
  { value: 3, label: "近3天" },
  { value: 7, label: "近7天" },
  { value: 30, label: "近30天" },
];

const deviceGranularityOptions = [
  { value: "day", label: "按日" },
  { value: "week", label: "按周" },
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
    ...item,
    id: item.id,
    title,
    meta: meta || item.device_name || item.status || "未关联对象",
    level: item.level ?? "一般",
    time: formatAlarmTime(item.time),
    tone: getAlarmTone(item.level),
  };
}

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

function formatTrendBucket(value, granularity) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  if (granularity === "hour") {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Shanghai",
    })
      .format(date)
      .replaceAll("/", "-");
  }

  const day = formatTrendDay(date);
  return granularity === "week" ? `${day}周` : day;
}

function getShanghaiBucketParts(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { day: "", hour: "" };
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Shanghai",
  }).formatToParts(date);

  return {
    day: parts.find((part) => part.type === "day")?.value ?? "",
    hour: parts.find((part) => part.type === "hour")?.value ?? "",
  };
}

function buildHourlyDayBoundaries(items) {
  return items.flatMap((item, index) => {
    if (index === 0) return [];
    const current = getShanghaiBucketParts(item.bucket_start ?? item.date);
    if (current.hour !== "00") return [];
    const previous = getShanghaiBucketParts(
      items[index - 1].bucket_start ?? items[index - 1].date
    );
    return [{ index, previousDay: previous.day, currentDay: current.day }];
  });
}

function buildAlarmTrendLines(items) {
  return [
    {
      label: "重大",
      color: "hsl(348 83% 47%)",
      values: items.map((item) => Number(item.major ?? 0)),
    },
    {
      label: "严重",
      color: "hsl(25 95% 53%)",
      values: items.map((item) => Number(item.severe ?? 0)),
    },
    {
      label: "一般",
      color: "hsl(48 96% 50%)",
      values: items.map((item) => Number(item.general ?? 0)),
    },
  ];
}

function Card({
  title,
  value,
  unit,
  icon,
  tone,
  comparison,
  sparkValues,
  isLoading,
  hasError,
}) {
  const displayValue = isLoading || hasError ? "--" : value;
  const comparisonLabel =
    isLoading || hasError ? "--" : comparison?.label ?? "暂无昨日数据";
  const comparisonTone = comparison?.trend === "down" ? "gray" : tone;

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
        <MetricDelta $tone={comparisonTone}>{comparisonLabel}</MetricDelta>
        <MetricLabel>{hasError ? "数据获取失败" : "较昨日"}</MetricLabel>
      </MetricFooter>
      <MiniAreaSparkline
        values={sparkValues}
        color={(toneColors[tone] ?? toneColors.gray).text}
      />
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

function DashboardSection({ title, action, children, className, ...delegated }) {
  return (
    <Panel className={className} {...delegated}>
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
        {action ? <PanelAction>{action}</PanelAction> : null}
      </PanelHeader>
      {children}
    </Panel>
  );
}

function HealthHeatmapGrid({ zones, buckets, itemByCell, granularity, expanded }) {
  return (
    <Heatmap $count={buckets.length} $expanded={expanded}>
      {zones.map((zone) => (
        <React.Fragment key={zone}>
          <HeatmapLabel title={zone} $expanded={expanded}>{zone}</HeatmapLabel>
          {buckets.map((bucket) => {
            const item = itemByCell.get(`${zone}|${bucket}`);
            const observedPeople = Number(item?.observed_people ?? 0);
            const riskRatio = Number(item?.risk_ratio ?? 0);

            return (
              <HeatmapCell
                key={`${zone}-${bucket}`}
                $strength={riskRatio}
                $isEmpty={observedPeople === 0}
                $expanded={expanded}
                tabIndex="0"
                aria-label={`${zone} ${formatTrendBucket(
                  bucket,
                  granularity
                )}，观测${observedPeople}人，中风险${
                  item?.medium_risk_people ?? 0
                }人，高风险${item?.high_risk_people ?? 0}人`}
              >
                <HeatmapTooltip>
                  <strong>{zone}</strong>
                  <span>{formatTrendBucket(bucket, granularity)}</span>
                  <span>观测人员：{observedPeople}人</span>
                  <span>中风险：{item?.medium_risk_people ?? 0}人</span>
                  <span>高风险：{item?.high_risk_people ?? 0}人</span>
                </HeatmapTooltip>
              </HeatmapCell>
            );
          })}
        </React.Fragment>
      ))}
    </Heatmap>
  );
}

function ChartPanelBody({ children }) {
  return <ChartPanelContent>{children}</ChartPanelContent>;
}

function FactoryMapCard({ alarms }) {
  const [mapLayers, setMapLayers] = useState({
    people: true,
    devices: true,
    areas: true,
    alarms: true,
  });
  const toggleLayer = (key) => {
    setMapLayers((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <DashboardSection
      title="厂区人员与设备分布"
      action={
        <MapToggles>
          <TogglePill type="button" $active={mapLayers.people} aria-pressed={mapLayers.people} onClick={() => toggleLayer("people")}>人员</TogglePill>
          <TogglePill type="button" $active={mapLayers.devices} aria-pressed={mapLayers.devices} onClick={() => toggleLayer("devices")}>设备</TogglePill>
          <TogglePill type="button" $active={mapLayers.areas} aria-pressed={mapLayers.areas} onClick={() => toggleLayer("areas")}>风险区域</TogglePill>
          <TogglePill type="button" $active={mapLayers.alarms} aria-pressed={mapLayers.alarms} onClick={() => toggleLayer("alarms")}>告警</TogglePill>
        </MapToggles>
      }
    >
      <BaiduSatelliteMap layers={mapLayers} alarms={alarms} />
    </DashboardSection>
  );
}

function RealtimeAlarmCard({ total, items, hasError, isLoading }) {
  const displayItems = isLoading || hasError ? [] : items;
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
    <DashboardSection
      title="实时告警"
      action={<PanelActionLink to="/alarm-center">查看更多</PanelActionLink>}
    >
      <AlarmSummary>今日累计 {isLoading || hasError ? "--" : total ?? "--"} 条</AlarmSummary>
      <AlarmList>
        {alarmStatusMessage ? (
          <AlarmStatusMessage>{alarmStatusMessage}</AlarmStatusMessage>
        ) : null}
        {fixedRows.map((item, index) => (
          <AlarmRow
            key={
              item
                ? item.id
                : `empty-${index}`
            }
            to={item ? `/alarm-center?alarm_id=${encodeURIComponent(item.id)}` : "/alarm-center"}
            $isEmpty={!item}
            tabIndex={item ? 0 : -1}
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

function MultiLineChart({ lines, dayBoundaries = [] }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const svgRef = useRef(null);
  const [chartSize, setChartSize] = useState({ width: 420, height: 150 });
  const { width, height } = chartSize;
  const padding = {
    top: dayBoundaries.length > 0 ? 20 : 8,
    right: 8,
    bottom: 6,
    left: 30,
  };
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

  useEffect(() => {
    const svg = svgRef.current;

    if (!svg) {
      return undefined;
    }

    const updateSize = () => {
      const bounds = svg.getBoundingClientRect();

      if (bounds.width > 0 && bounds.height > 0) {
        setChartSize({ width: bounds.width, height: bounds.height });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(svg);

    return () => observer.disconnect();
  }, []);

  return (
    <ChartSvg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="告警等级趋势曲线"
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
      {dayBoundaries.map((boundary) => {
        const x = getX(boundary.index, lines[0]?.values.length ?? 0);
        return (
          <React.Fragment key={`${boundary.index}-${boundary.currentDay}`}>
            <DayDivider x1={x} x2={x} y1={14} y2={height - padding.bottom} />
            <DayBoundaryLabel x={x - 4} y="10" textAnchor="end">
              {boundary.previousDay}日
            </DayBoundaryLabel>
            <DayBoundaryLabel x={x + 4} y="10" textAnchor="start">
              {boundary.currentDay}日
            </DayBoundaryLabel>
          </React.Fragment>
        );
      })}
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
                    ? 4
                    : 2.5
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

function DeviceOnlineRateChart({ items }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const svgRef = useRef(null);
  const [chartSize, setChartSize] = useState({ width: 420, height: 150 });
  const { width, height } = chartSize;
  const padding = { top: 10, right: 10, bottom: 8, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const getX = (index) =>
    padding.left + ((index + 0.5) / Math.max(items.length, 1)) * plotWidth;
  const getY = (value) =>
    height - padding.bottom - (Number(value) / 100) * plotHeight;
  const points = items.map((item, index) => ({
    ...item,
    x: getX(index),
    y: getY(item.online_rate),
  }));

  useEffect(() => {
    const svg = svgRef.current;

    if (!svg) {
      return undefined;
    }

    const updateSize = () => {
      const bounds = svg.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        setChartSize({ width: bounds.width, height: bounds.height });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const tooltipWidth = 108;
  const tooltipHeight = 66;
  const tooltipX = hoveredPoint
    ? Math.min(
        Math.max(hoveredPoint.x - tooltipWidth / 2, padding.left),
        width - padding.right - tooltipWidth
      )
    : 0;
  const tooltipY = hoveredPoint
    ? Math.min(
        Math.max(hoveredPoint.y - tooltipHeight - 5, padding.top),
        height - padding.bottom - tooltipHeight
      )
    : 0;

  return (
    <ChartSvg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="设备在线率趋势曲线"
      onMouseLeave={() => setHoveredPoint(null)}
    >
      {[0, 25, 50, 75, 100].map((value) => {
        const y = getY(value);
        return (
          <React.Fragment key={value}>
            <GridLine
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
            />
            <ChartYAxisLabel x={padding.left - 5} y={y + 3}>
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
      <DeviceOnlineCurve
        d={buildSmoothPath(points)}
        fill="none"
        stroke={dashboardPalette.blue}
      />
      {points.map((point, index) => (
        <TrendPoint
          key={`${point.bucket_start}-${index}-dot`}
          cx={point.x}
          cy={point.y}
          r={hoveredPoint?.bucket_start === point.bucket_start ? 4 : 2.5}
          fill={dashboardPalette.blue}
        />
      ))}
      {points.map((point, index) => (
        <TrendHitPoint
          key={`${point.bucket_start}-${index}`}
          cx={point.x}
          cy={point.y}
          r="10"
          tabIndex="0"
          onMouseEnter={() => setHoveredPoint(point)}
          onFocus={() => setHoveredPoint(point)}
          onBlur={() => setHoveredPoint(null)}
        >
          <title>{`在线率 ${point.online_rate}%`}</title>
        </TrendHitPoint>
      ))}
      {hoveredPoint ? (
        <DeviceChartTooltip transform={`translate(${tooltipX} ${tooltipY})`}>
          <rect width={tooltipWidth} height={tooltipHeight} rx="5" />
          <text x="8" y="15">
            在线率：{hoveredPoint.online_rate}%
          </text>
          <text x="8" y="29">
            在线：{hoveredPoint.online_count}/{hoveredPoint.total_count}
          </text>
          <text x="8" y="43">
            离线：{hoveredPoint.offline_count}　故障：{hoveredPoint.fault_count}
          </text>
          <text x="8" y="57">
            维护：{hoveredPoint.maintenance_count}　未知：
            {hoveredPoint.unknown_count}
          </text>
        </DeviceChartTooltip>
      ) : null}
    </ChartSvg>
  );
}

function AlarmTrendCard({
  items,
  isLoading,
  hasError,
  rangeDays,
  granularity,
  onRangeDaysChange,
  onGranularityChange,
}) {
  const lines = buildAlarmTrendLines(items);
  const days = items.map((item) => {
    const value = item.bucket_start ?? item.date;
    return granularity === "hour"
      ? `${getShanghaiBucketParts(value).hour}时`
      : formatTrendBucket(value, granularity);
  });
  const dayBoundaries =
    granularity === "hour" ? buildHourlyDayBoundaries(items) : [];
  const labelInterval =
    granularity === "hour"
      ? items.length <= 24
        ? 2
        : items.length <= 72
        ? 6
        : 24
      : Math.max(1, Math.ceil(days.length / 7));
  const statusMessage = isLoading
    ? "告警趋势加载中..."
    : hasError
    ? "告警趋势加载失败"
    : items.length === 0
    ? "当前时间范围暂无告警数据"
    : null;

  return (
    <DashboardSection
      title="告警趋势分析"
      action={
        <SmallFilters>
          <TrendFilterSelect
            aria-label="时间范围"
            value={rangeDays}
            onChange={(event) => onRangeDaysChange(Number(event.target.value))}
          >
            <option value="1">近1天</option>
            <option value="3">近3天</option>
            <option value="7">近7天</option>
            <option value="30">近30天</option>
          </TrendFilterSelect>
          <TrendFilterSelect
            aria-label="聚合粒度"
            value={granularity}
            onChange={(event) => onGranularityChange(event.target.value)}
          >
            <option value="hour">按小时</option>
            <option value="day">按日</option>
            <option value="week">按周</option>
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
            <MultiLineChart lines={lines} dayBoundaries={dayBoundaries} />
          )}
        </ChartCanvas>
        <AlarmChartAxis $count={Math.max(days.length, 1)}>
          {days.map((day, index) => (
            <span key={`${day}-${index}`}>
              {index % labelInterval === 0 || index === days.length - 1
                ? day
                : ""}
            </span>
          ))}
        </AlarmChartAxis>
      </ChartPanelBody>
    </DashboardSection>
  );
}

function HealthHeatmapCard({
  data,
  isLoading,
  hasError,
  rangeDays,
  granularity,
  onRangeDaysChange,
  onGranularityChange,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const zones = data?.zones ?? [];
  const cardZones = zones.slice(0, 4);
  const buckets = data?.buckets ?? [];
  const itemByCell = new Map(
    (data?.items ?? []).map((item) => [
      `${item.location_zone}|${item.bucket_start}`,
      item,
    ])
  );
  const labels = buckets.map((bucket) =>
    formatTrendBucket(bucket, granularity)
  );
  const labelInterval = Math.max(1, Math.ceil(labels.length / 7));
  const statusMessage = isLoading
    ? "人员健康分析加载中..."
    : hasError
    ? "人员健康分析加载失败"
    : zones.length === 0 || buckets.length === 0
    ? "暂无人员健康观测数据"
    : null;

  useEffect(() => {
    if (!isExpanded) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsExpanded(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  const filters = (
    <SmallFilters onClick={(event) => event.stopPropagation()}>
      <TrendFilterSelect
        aria-label="健康分析时间范围"
        value={rangeDays}
        onChange={(event) => onRangeDaysChange(Number(event.target.value))}
      >
        <option value="7">近7天</option>
        <option value="30">近30天</option>
      </TrendFilterSelect>
      <TrendFilterSelect
        aria-label="健康分析聚合粒度"
        value={granularity}
        onChange={(event) => onGranularityChange(event.target.value)}
      >
        <option value="day">按日</option>
        <option value="week">按周</option>
      </TrendFilterSelect>
    </SmallFilters>
  );

  const renderAxis = (expanded = false) => (
    <HealthChartAxis
      $count={Math.max(buckets.length, 1)}
      $expanded={expanded}
    >
      {labels.map((label, index) => (
        <span key={`${label}-${index}`}>
          {index % labelInterval === 0 || index === labels.length - 1
            ? label
            : ""}
        </span>
      ))}
    </HealthChartAxis>
  );

  return (
    <>
      <DashboardSection
        title="人员健康分析"
        action={
          <HealthActions>
            {filters}
            <ExpandButton
              type="button"
              title="展开人员健康分析"
              onClick={(event) => {
                event.stopPropagation();
                setIsExpanded(true);
              }}
            >
              <Maximize2 size={14} />
            </ExpandButton>
          </HealthActions>
        }
        $clickable
        data-testid="health-heatmap-card"
        onClick={() => setIsExpanded(true)}
      >
        <ChartPanelBody>
          <HealthLegend aria-label="健康风险比例图例">
            <span>低风险</span>
            <HealthLegendGradient />
            <span>高风险</span>
          </HealthLegend>
          {statusMessage ? (
            <ChartStatusMessage>{statusMessage}</ChartStatusMessage>
          ) : (
            <HealthHeatmapGrid
              zones={cardZones}
              buckets={buckets}
              itemByCell={itemByCell}
              granularity={granularity}
            />
          )}
          {renderAxis()}
        </ChartPanelBody>
      </DashboardSection>

      {isExpanded ? (
        <HealthModalBackdrop onMouseDown={() => setIsExpanded(false)}>
          <HealthModal onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="人员健康分析全部区域">
            <HealthModalHeader>
              <div>
                <strong>人员健康分析</strong>
                <span>共 {zones.length} 个区域</span>
              </div>
              <HealthModalActions>
                {filters}
                <CloseModalButton type="button" title="关闭" onClick={() => setIsExpanded(false)}><X size={17} /></CloseModalButton>
              </HealthModalActions>
            </HealthModalHeader>
            <HealthModalBody>
              <HealthLegend aria-label="健康风险比例图例">
                <span>低风险</span><HealthLegendGradient /><span>高风险</span>
              </HealthLegend>
              {statusMessage ? (
                <ChartStatusMessage>{statusMessage}</ChartStatusMessage>
              ) : (
                <ExpandedHeatmapScroller>
                  <HealthHeatmapGrid zones={zones} buckets={buckets} itemByCell={itemByCell} granularity={granularity} expanded />
                </ExpandedHeatmapScroller>
              )}
              {renderAxis(true)}
            </HealthModalBody>
          </HealthModal>
        </HealthModalBackdrop>
      ) : null}
    </>
  );
}

function DeviceOnlineTrendCard({
  items,
  isLoading,
  hasError,
  rangeDays,
  granularity,
  onRangeDaysChange,
  onGranularityChange,
}) {
  const labels = items.map((item) =>
    formatTrendBucket(item.bucket_start, granularity)
  );
  const labelInterval = Math.max(1, Math.ceil(labels.length / 7));
  const statusMessage = isLoading
    ? "设备在线率趋势加载中..."
    : hasError
    ? "设备在线率趋势加载失败"
    : items.length === 0
    ? "当前时间范围暂无设备状态数据"
    : null;

  return (
    <DashboardSection
      title="设备在线率趋势"
      action={
        <SmallFilters>
          <SegmentedControl aria-label="设备趋势时间范围">
            {trendRangeOptions.map((option) => (
              <SegmentButton
                key={option.value}
                type="button"
                $isActive={rangeDays === option.value}
                onClick={() => onRangeDaysChange(option.value)}
              >
                {option.label}
              </SegmentButton>
            ))}
          </SegmentedControl>
          <SegmentedControl aria-label="设备趋势聚合粒度">
            {deviceGranularityOptions.map((option) => (
              <SegmentButton
                key={option.value}
                type="button"
                $isActive={granularity === option.value}
                onClick={() => onGranularityChange(option.value)}
              >
                {option.label}
              </SegmentButton>
            ))}
          </SegmentedControl>
        </SmallFilters>
      }
    >
      <DeviceChartPanelBody>
        <ChartLegendSpacer aria-hidden="true" />
        <ChartCanvas>
          {statusMessage ? (
            <ChartStatusMessage>{statusMessage}</ChartStatusMessage>
          ) : (
            <DeviceOnlineRateChart items={items} />
          )}
        </ChartCanvas>
        <DeviceChartAxis $count={Math.max(labels.length, 1)}>
          {labels.map((label, index) => (
            <span key={`${label}-${index}`}>
              {index % labelInterval === 0 || index === labels.length - 1
                ? label
                : ""}
            </span>
          ))}
        </DeviceChartAxis>
      </DeviceChartPanelBody>
    </DashboardSection>
  );
}

function Dashboard() {
  const initialMetrics = getCachedJson(DASHBOARD_URLS.metrics);
  const initialAlarms = getCachedJson(DASHBOARD_URLS.alarms);
  const initialAlarmTrend = getCachedJson(DASHBOARD_URLS.alarmTrend);
  const initialPersonHealth = getCachedJson(DASHBOARD_URLS.personHealth);
  const initialDeviceTrend = getCachedJson(DASHBOARD_URLS.deviceTrend);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [realtimeAlarms, setRealtimeAlarms] = useState(() =>
    (initialAlarms?.items ?? []).map(normalizeRealtimeAlarm)
  );
  const [isLoading, setIsLoading] = useState(() => !initialMetrics);
  const [hasError, setHasError] = useState(false);
  const [alarmHasError, setAlarmHasError] = useState(false);
  const [isAlarmLoading, setIsAlarmLoading] = useState(() => !initialAlarms);
  const [alarmTrend, setAlarmTrend] = useState(initialAlarmTrend?.items ?? []);
  const [alarmTrendHasError, setAlarmTrendHasError] = useState(false);
  const [isAlarmTrendLoading, setIsAlarmTrendLoading] = useState(() => !initialAlarmTrend);
  const [alarmTrendRangeDays, setAlarmTrendRangeDays] = useState(7);
  const [alarmTrendGranularity, setAlarmTrendGranularity] = useState("day");
  const [personHealthAnalysis, setPersonHealthAnalysis] = useState(initialPersonHealth);
  const [personHealthHasError, setPersonHealthHasError] = useState(false);
  const [isPersonHealthLoading, setIsPersonHealthLoading] = useState(() => !initialPersonHealth);
  const [personHealthRangeDays, setPersonHealthRangeDays] = useState(7);
  const [personHealthGranularity, setPersonHealthGranularity] = useState("day");
  const [deviceOnlineTrend, setDeviceOnlineTrend] = useState(initialDeviceTrend?.items ?? []);
  const [deviceOnlineTrendHasError, setDeviceOnlineTrendHasError] =
    useState(false);
  const [isDeviceOnlineTrendLoading, setIsDeviceOnlineTrendLoading] =
    useState(() => !initialDeviceTrend);
  const [deviceOnlineTrendRangeDays, setDeviceOnlineTrendRangeDays] =
    useState(7);
  const [deviceOnlineTrendGranularity, setDeviceOnlineTrendGranularity] =
    useState("day");

  useEffect(() => {
    void warmApplicationPages();
  }, []);

  const metricSparkSeries = useMemo(() => {
    const alarmTotals = alarmTrend.map(
      (item) =>
        Number(item.major ?? 0) +
        Number(item.severe ?? 0) +
        Number(item.general ?? 0)
    );
    const riskTotals = alarmTrend.map(
      (item) => Number(item.major ?? 0) + Number(item.severe ?? 0)
    );
    const healthByBucket = new Map();

    for (const item of personHealthAnalysis?.items ?? []) {
      const bucket = item.bucket_start ?? item.bucket;
      healthByBucket.set(
        bucket,
        (healthByBucket.get(bucket) ?? 0) + Number(item.observed_people ?? 0)
      );
    }

    return {
      online_person_count: [...healthByBucket.values()],
      device_online_rate: deviceOnlineTrend.map((item) =>
        Number(item.online_rate ?? item.value ?? 0)
      ),
      today_alarm_count: alarmTotals,
      risk_area_count: riskTotals,
    };
  }, [alarmTrend, deviceOnlineTrend, personHealthAnalysis]);

  useEffect(() => {
    let ignore = false;

    async function loadMetrics() {
      const cachedMetrics = getCachedJson(DASHBOARD_URLS.metrics);
      try {
        setHasError(false);
        setIsLoading(!cachedMetrics);
        const data = await loadCachedJson(DASHBOARD_URLS.metrics, {
          force: Boolean(cachedMetrics),
        });

        if (!ignore) {
          setMetrics(data);
        }
      } catch {
        if (!ignore && !cachedMetrics) {
          setHasError(true);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    async function loadRealtimeAlarms() {
      const cachedAlarms = getCachedJson(DASHBOARD_URLS.alarms);
      try {
        setIsAlarmLoading(!cachedAlarms);
        setAlarmHasError(false);
        const data = await loadCachedJson(DASHBOARD_URLS.alarms, {
          force: Boolean(cachedAlarms),
        });

        if (!ignore) {
          const alarmItems = data.items ?? [];
          await warmAlarmCenter(alarmItems);
          if (ignore) return;
          setRealtimeAlarms(alarmItems.map(normalizeRealtimeAlarm));
        }
      } catch {
        if (!ignore && !cachedAlarms) {
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
      const trendUrl = `${API_BASE_URL}/dashboard/alarm-trend?days=${alarmTrendRangeDays}&granularity=${alarmTrendGranularity}`;
      const cachedTrend = getCachedJson(trendUrl);
      try {
        setIsAlarmTrendLoading(!cachedTrend);
        setAlarmTrendHasError(false);
        const data = await loadCachedJson(trendUrl, {
          force: Boolean(cachedTrend),
        });

        if (!ignore) {
          setAlarmTrend(data.items ?? []);
        }
      } catch {
        if (!ignore && !cachedTrend) {
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
  }, [alarmTrendGranularity, alarmTrendRangeDays]);

  useEffect(() => {
    let ignore = false;

    async function loadPersonHealthAnalysis() {
      const healthUrl = `${API_BASE_URL}/dashboard/person-health-analysis?days=${personHealthRangeDays}&granularity=${personHealthGranularity}`;
      const cachedHealth = getCachedJson(healthUrl);
      try {
        setIsPersonHealthLoading(!cachedHealth);
        setPersonHealthHasError(false);
        const data = await loadCachedJson(healthUrl, {
          force: Boolean(cachedHealth),
        });

        if (!ignore) {
          setPersonHealthAnalysis(data);
        }
      } catch {
        if (!ignore && !cachedHealth) {
          setPersonHealthHasError(true);
        }
      } finally {
        if (!ignore) {
          setIsPersonHealthLoading(false);
        }
      }
    }

    loadPersonHealthAnalysis();
    const intervalId = window.setInterval(loadPersonHealthAnalysis, 30000);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [personHealthGranularity, personHealthRangeDays]);

  useEffect(() => {
    let ignore = false;

    async function loadDeviceOnlineTrend() {
      const trendUrl = `${API_BASE_URL}/dashboard/device-online-trend?days=${deviceOnlineTrendRangeDays}&granularity=${deviceOnlineTrendGranularity}`;
      const cachedTrend = getCachedJson(trendUrl);
      try {
        setIsDeviceOnlineTrendLoading(!cachedTrend);
        setDeviceOnlineTrendHasError(false);
        const data = await loadCachedJson(trendUrl, {
          force: Boolean(cachedTrend),
        });
        if (!ignore) {
          setDeviceOnlineTrend(data.items ?? []);
        }
      } catch {
        if (!ignore && !cachedTrend) {
          setDeviceOnlineTrendHasError(true);
        }
      } finally {
        if (!ignore) {
          setIsDeviceOnlineTrendLoading(false);
        }
      }
    }

    loadDeviceOnlineTrend();
    const intervalId = window.setInterval(loadDeviceOnlineTrend, 30000);
    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [deviceOnlineTrendGranularity, deviceOnlineTrendRangeDays]);

  return (
    <Wrapper>
      <CardGrid>
        {metricCards.map(({ key, ...card }) => (
          <Card
            key={key}
            {...card}
            value={metrics?.[key]}
            comparison={metrics?.metric_comparisons?.[key]}
            sparkValues={
              metricSparkSeries[key]?.length
                ? metricSparkSeries[key]
                : [1, 2, 1.5, 2.8, 2.2, 3.2, 2.7]
            }
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
        <FactoryMapCard alarms={realtimeAlarms} />
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
          rangeDays={alarmTrendRangeDays}
          granularity={alarmTrendGranularity}
          onRangeDaysChange={setAlarmTrendRangeDays}
          onGranularityChange={setAlarmTrendGranularity}
        />
        <HealthHeatmapCard
          data={personHealthAnalysis}
          isLoading={isPersonHealthLoading}
          hasError={personHealthHasError}
          rangeDays={personHealthRangeDays}
          granularity={personHealthGranularity}
          onRangeDaysChange={setPersonHealthRangeDays}
          onGranularityChange={setPersonHealthGranularity}
        />
        <DeviceOnlineTrendCard
          items={deviceOnlineTrend}
          isLoading={isDeviceOnlineTrendLoading}
          hasError={deviceOnlineTrendHasError}
          rangeDays={deviceOnlineTrendRangeDays}
          granularity={deviceOnlineTrendGranularity}
          onRangeDaysChange={setDeviceOnlineTrendRangeDays}
          onGranularityChange={setDeviceOnlineTrendGranularity}
        />
      </BottomGrid>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: 104px minmax(0, 1fr) 212px;
  gap: 8px;
  overflow: hidden;
  background-color: hsl(0 0% 97.5%);
  padding: 8px;

  @media (max-height: 780px) {
    grid-template-rows: 100px minmax(0, 1fr) 180px;
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
  grid-auto-rows: 104px;

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
  grid-template-rows: auto auto auto 26px;
  column-gap: 12px;
  row-gap: 0;
  align-content: center;
  border: 1px solid hsl(220 13% 90%);
  border-radius: 8px;
  background: hsl(0 0% 100%);
  padding: 8px 16px 6px;

  > svg {
    grid-column: 1 / -1;
    grid-row: 4;
    height: 26px;
    margin-top: 2px;
  }
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
  background: ${(p) => (toneColors[p.$tone] ?? toneColors.gray).text};
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
  color: ${(p) => (toneColors[p.$tone] ?? toneColors.gray).text};
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
  cursor: ${(p) => (p.$clickable ? "pointer" : "default")};
  transition: border-color 120ms ease, box-shadow 120ms ease;

  ${(p) =>
    p.$clickable
      ? `
        &:hover {
          border-color: hsl(217 72% 72%);
          box-shadow: 0 3px 12px hsl(218 30% 20% / 0.08);
        }
      `
      : ""}
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

const PanelActionLink = styled(Link)`
  color: inherit;
  text-decoration: none;

  &:hover {
    color: hsl(214 92% 46%);
  }

  &:focus-visible {
    outline: 2px solid ${dashboardPalette.softBlue};
    outline-offset: 3px;
    border-radius: 4px;
  }
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

const TogglePill = styled.button`
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  position: relative;
  padding-left: 14px;
  border: 0;
  color: ${(p) => p.$active ? "hsl(218 16% 28%)" : "hsl(218 9% 58%)"};
  background: transparent;
  font: inherit;
  cursor: pointer;

  &::before {
    content: "${(p) => p.$active ? "✓" : ""}";
    position: absolute;
    left: 0;
    top: 50%;
    width: 11px;
    height: 11px;
    border-radius: 3px;
    display: grid;
    place-items: center;
    border: 1px solid ${(p) => p.$active ? dashboardPalette.blue : "hsl(220 13% 76%)"};
    background: ${(p) => p.$active ? dashboardPalette.blue : "white"};
    color: white;
    font-size: ${FONT_SIZES.dashboardCheckMark};
    line-height: 1;
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

const AlarmRow = styled(Link)`
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 46px 66px;
  align-items: center;
  gap: 8px;
  height: 52px;
  border-bottom: 1px solid hsl(220 13% 92%);
  opacity: ${(p) => (p.$isEmpty ? 0 : 1)};
  pointer-events: ${(p) => (p.$isEmpty ? "none" : "auto")};
  color: inherit;
  text-decoration: none;
  transition: background-color 150ms ease;

  &:hover,
  &:focus-visible {
    background: hsl(214 100% 97%);
    outline: none;
  }
`;

const AlarmIcon = styled.div`
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 100%;
  color: ${(p) => (mapToneColors[p.$tone] ?? mapToneColors.amber).text};
  background: ${(p) =>
    (mapToneColors[p.$tone] ?? mapToneColors.amber).background};
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
  color: ${(p) => (mapToneColors[p.$tone] ?? mapToneColors.amber).text};
  background: ${(p) =>
    (mapToneColors[p.$tone] ?? mapToneColors.amber).background};
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
    padding: 8px 14px 8px;
  }

  ${PanelHeader} {
    min-height: 24px;
  }

  ${PanelTitle} {
    font-size: 0.8125rem;
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
  padding-top: 2px;
`;

const DeviceChartPanelBody = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: 16px minmax(0, 1fr) 20px;
  row-gap: 8px;
  padding-top: 2px;
`;

const ChartLegendSpacer = styled.div`
  min-height: 0;
`;

const SmallFilters = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  overflow: hidden;
`;

const HealthActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
`;

const ExpandButton = styled.button`
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid hsl(220 13% 82%);
  border-radius: 5px;
  color: hsl(218 10% 38%);
  background: white;
  cursor: pointer;

  &:hover {
    border-color: hsl(217 91% 64%);
    color: ${dashboardPalette.blue};
  }
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

const SegmentedControl = styled.div`
  flex: 0 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  overflow: hidden;
  border: 1px solid hsl(220 13% 82%);
  border-radius: 6px;
  background: hsl(0 0% 100%);
`;

const SegmentButton = styled.button`
  min-width: 0;
  border: 0;
  border-right: 1px solid hsl(220 13% 88%);
  padding: 4px 8px;
  color: ${(p) => (p.$isActive ? "white" : "hsl(218 10% 42%)")};
  background: ${(p) => (p.$isActive ? dashboardPalette.blue : "transparent")};
  font: inherit;
  font-size: ${FONT_SIZES.dashboardFilter};
  font-weight: ${(p) => (p.$isActive ? 700 : 500)};
  white-space: nowrap;
  cursor: pointer;

  &:last-child {
    border-right: 0;
  }

  &:hover {
    color: ${(p) => (p.$isActive ? "white" : dashboardPalette.blue)};
    background: ${(p) =>
      p.$isActive ? dashboardPalette.blue : dashboardPalette.softBlue};
  }

  &:focus-visible {
    position: relative;
    z-index: 1;
    outline: 2px solid hsl(214 92% 42%);
    outline-offset: -2px;
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

const DayDivider = styled.line`
  stroke: hsl(218 16% 62%);
  stroke-width: 1;
  stroke-dasharray: 3 4;
`;

const DayBoundaryLabel = styled.text`
  fill: hsl(218 10% 42%);
  font-family: var(--font-data);
  font-size: ${FONT_SIZES.dashboardAxis};
  font-weight: 700;
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

const DeviceOnlineCurve = styled(ChartCurve)`
  stroke-width: 3;
`;

const TrendPoint = styled.circle`
  stroke: none;
  cursor: pointer;

  &:focus {
    outline: none;
  }
`;

const TrendHitPoint = styled.circle`
  fill: transparent;
  stroke: transparent;
  cursor: pointer;

  &:focus {
    outline: none;
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

const DeviceChartTooltip = styled.g`
  pointer-events: none;

  rect {
    fill: hsl(220 22% 18% / 0.96);
  }

  text {
    fill: white;
    font-size: ${FONT_SIZES.dashboardAxis};
    text-anchor: start;
  }
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
  grid-template-columns: repeat(${(p) => p.$count}, minmax(0, 1fr));
  padding-left: 30px;
  padding-right: 8px;
  gap: 0;

  span {
    min-width: 0;
    white-space: nowrap;
  }
`;

const DeviceChartAxis = styled(AlarmChartAxis)`
  padding-left: 34px;
  padding-right: 10px;
`;

const Heatmap = styled.div`
  min-height: 0;
  align-self: center;
  display: grid;
  grid-template-columns: ${(p) => (p.$expanded ? "132px" : "88px")} repeat(${(p) => p.$count}, minmax(0, 1fr));
  gap: ${(p) => (p.$expanded ? "6px" : "4px")};
`;

const HeatmapLabel = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: hsl(218 10% 42%);
  font-size: ${FONT_SIZES.dashboardHeatmapLabel};
  line-height: ${(p) => (p.$expanded ? "26px" : "20px")};
`;

const HeatmapCell = styled.div`
  position: relative;
  height: ${(p) => (p.$expanded ? "26px" : "20px")};
  border-radius: 3px;
  background: ${(p) =>
    p.$isEmpty
      ? "hsl(220 13% 92%)"
      : `hsl(${120 - p.$strength * 1.2} 82% 50%)`};
  cursor: help;

  &:focus {
    outline: 2px solid hsl(214 92% 35%);
    outline-offset: 1px;
  }

  &:hover > div,
  &:focus > div {
    visibility: visible;
    opacity: 1;
    transform: translate(-50%, -4px);
  }
`;

const HealthLegend = styled.div`
  min-width: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 5px;
  color: hsl(218 10% 52%);
  font-size: ${FONT_SIZES.dashboardChartLegend};
  align-self: center;
`;

const HealthLegendGradient = styled.span`
  width: 54px;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    hsl(120 82% 45%),
    hsl(60 92% 50%),
    hsl(0 82% 52%)
  );
`;

const HeatmapTooltip = styled.div`
  position: absolute;
  left: 50%;
  bottom: 100%;
  z-index: 20;
  width: 132px;
  display: grid;
  gap: 2px;
  visibility: hidden;
  opacity: 0;
  transform: translate(-50%, 2px);
  transition: opacity 120ms ease, transform 120ms ease;
  pointer-events: none;
  border-radius: 6px;
  padding: 7px 8px;
  color: white;
  background: hsl(220 22% 18% / 0.96);
  box-shadow: 0 4px 12px hsl(220 20% 10% / 0.24);
  font-size: ${FONT_SIZES.dashboardAxis};
  line-height: 1.3;

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const HealthChartAxis = styled(ChartAxis)`
  box-sizing: border-box;
  grid-template-columns: repeat(${(p) => p.$count}, minmax(0, 1fr));
  padding-left: ${(p) => (p.$expanded ? "138px" : "92px")};
  gap: 0;

  span {
    min-width: 0;
    white-space: nowrap;
  }
`;

const HealthModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 44px;
  background: hsl(220 24% 10% / 0.46);
  cursor: default;
`;

const HealthModal = styled.section`
  width: min(1180px, calc(100vw - 120px));
  height: min(720px, calc(100vh - 110px));
  min-height: 0;
  display: grid;
  grid-template-rows: 58px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid hsl(220 13% 84%);
  border-radius: 8px;
  background: white;
  box-shadow: 0 22px 56px hsl(220 32% 10% / 0.28);
`;

const HealthModalHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-bottom: 1px solid hsl(220 13% 88%);
  padding: 0 18px;

  > div:first-child {
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  strong {
    color: hsl(218 20% 18%);
    font-size: 0.9375rem;
  }

  span {
    color: hsl(218 10% 48%);
    font-size: 0.6875rem;
  }
`;

const HealthModalActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CloseModalButton = styled.button`
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid hsl(220 13% 84%);
  border-radius: 5px;
  color: hsl(218 12% 34%);
  background: white;
  cursor: pointer;

  &:hover {
    color: hsl(0 72% 48%);
    border-color: hsl(0 72% 78%);
  }
`;

const HealthModalBody = styled.div`
  min-height: 0;
  display: grid;
  grid-template-rows: 24px minmax(0, 1fr) 24px;
  gap: 10px;
  padding: 14px 18px 16px;
`;

const ExpandedHeatmapScroller = styled.div`
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 8px 4px 0;

  ${Heatmap} {
    width: 100%;
    align-self: start;
  }
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
  gray: {
    text: "hsl(218 10% 48%)",
    background: "hsl(218 10% 48% / 0.12)",
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
