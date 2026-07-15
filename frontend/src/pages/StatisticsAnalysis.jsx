import React, { useEffect, useState } from "react";
import styled from "styled-components";
import {
  CalendarDays,
  Database,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  UserRound,
  Zap,
} from "lucide-react";
import { API_BASE_URL } from "../config/api";
import { COLORS, FONT_SIZES } from "../constants/STYLES";

const chartColors = {
  blue: "hsl(217 93% 52%)",
  green: "hsl(164 72% 42%)",
  purple: "hsl(258 90% 65%)",
  orange: "hsl(28 96% 54%)",
  red: "hsl(0 83% 60%)",
  gray: "hsl(215 12% 72%)",
};

const metricCards = [
  {
    key: "alarm_count",
    title: "告警总数",
    unit: "次",
    icon: Siren,
    color: chartColors.blue,
    delta: "8.6%",
  },
  {
    key: "person_count",
    title: "人员总数",
    unit: "人",
    icon: UserRound,
    color: chartColors.green,
    delta: "12.4%",
  },
  {
    key: "device_count",
    title: "设备总数",
    unit: "台",
    icon: Database,
    color: chartColors.purple,
    delta: "5.7%",
  },
  {
    key: "risk_area_count",
    title: "风险区域数",
    unit: "个",
    icon: ShieldAlert,
    color: chartColors.orange,
    delta: "11.1%",
  },
  {
    key: "device_online_rate",
    title: "设备在线率",
    unit: "%",
    icon: ShieldCheck,
    color: chartColors.green,
    delta: "1.2%",
  },
  {
    key: "today_alarm_count",
    title: "今日告警数",
    unit: "次",
    icon: Zap,
    color: chartColors.red,
    delta: "8.6%",
  },
];

const defaultData = {
  metrics: {
    alarm_count: 0,
    person_count: 0,
    device_count: 0,
    risk_area_count: 0,
    device_online_rate: 0,
    today_alarm_count: 0,
  },
  alarm_trend: [],
  person_distribution: [],
  device_online_trend: [],
  alarm_type_distribution: [],
  risk_level_distribution: [],
  area_heat: [],
  alarm_duration_distribution: [],
  top_devices: [],
  top_areas: [],
  top_people: [],
  device_type_distribution: [],
};

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("zh-CN");
}

function normalizeSeries(items, key) {
  return items.map((item) => Number(item[key] ?? item.value ?? item.count ?? 0));
}

function Sparkline({ values, color }) {
  const width = 170;
  const height = 32;
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = Math.max(maxValue - minValue, 1);
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - minValue) / range) * 22 - 5;
    return `${x},${y}`;
  });

  return (
    <SparkSvg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points.join(" ")} fill="none" stroke={color} />
    </SparkSvg>
  );
}

function MultiLineChart({ items }) {
  const width = 460;
  const height = 160;
  const padding = { top: 18, right: 12, bottom: 24, left: 36 };
  const keys = [
    { key: "severe", label: "严重", color: chartColors.red },
    { key: "medium", label: "中等", color: chartColors.orange },
    { key: "general", label: "一般", color: chartColors.blue },
  ];
  const maxValue = Math.max(
    ...items.flatMap((item) => keys.map((line) => Number(item[line.key] ?? 0))),
    1
  );
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const getX = (index) =>
    padding.left + (index / Math.max(items.length - 1, 1)) * plotWidth;
  const getY = (value) =>
    padding.top + plotHeight - (Number(value) / maxValue) * plotHeight;

  return (
    <ChartBox>
      <ChartLegend>
        {keys.map((line) => (
          <LegendItem key={line.key} $color={line.color}>
            {line.label}
          </LegendItem>
        ))}
      </ChartLegend>
      <ChartSvg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="告警趋势">
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = padding.top + plotHeight - step * plotHeight;
          return <GridLine key={step} x1={padding.left} x2={width - padding.right} y1={y} y2={y} />;
        })}
        {keys.map((line) => {
          const path = items
            .map((item, index) => `${index === 0 ? "M" : "L"} ${getX(index)} ${getY(item[line.key])}`)
            .join(" ");
          return (
            <React.Fragment key={line.key}>
              <ChartPath d={path} stroke={line.color} />
              {items.map((item, index) => (
                <Point key={`${line.key}-${item.label}`} cx={getX(index)} cy={getY(item[line.key])} fill={line.color} />
              ))}
            </React.Fragment>
          );
        })}
        {items.map((item, index) => (
          <AxisLabel key={item.label} x={getX(index)} y={height - 5}>
            {item.label}
          </AxisLabel>
        ))}
      </ChartSvg>
    </ChartBox>
  );
}

function BarChart({ items }) {
  const maxValue = Math.max(...items.map((item) => item.count), 1);

  return (
    <BarChartWrap>
      {items.map((item) => (
        <BarItem key={item.label}>
          <BarValue>{item.count}</BarValue>
          <BarColumn $height={(item.count / maxValue) * 100} />
          <BarLabel>{item.label}</BarLabel>
        </BarItem>
      ))}
    </BarChartWrap>
  );
}

function LineChart({ items }) {
  const width = 420;
  const height = 160;
  const padding = { top: 16, right: 14, bottom: 24, left: 36 };
  const values = items.map((item) => Number(item.value ?? 0));
  const maxValue = Math.max(...values, 100);
  const minValue = Math.min(...values, 70);
  const range = Math.max(maxValue - minValue, 1);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const getX = (index) =>
    padding.left + (index / Math.max(items.length - 1, 1)) * plotWidth;
  const getY = (value) =>
    padding.top + plotHeight - ((value - minValue) / range) * plotHeight;
  const path = items
    .map((item, index) => `${index === 0 ? "M" : "L"} ${getX(index)} ${getY(item.value)}`)
    .join(" ");

  return (
    <ChartSvg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="设备在线率趋势">
      {[0, 0.33, 0.66, 1].map((step) => {
        const y = padding.top + plotHeight - step * plotHeight;
        return <GridLine key={step} x1={padding.left} x2={width - padding.right} y1={y} y2={y} />;
      })}
      <ChartPath d={path} stroke={chartColors.blue} />
      {items.map((item, index) => (
        <Point key={item.label} cx={getX(index)} cy={getY(item.value)} fill={chartColors.blue} />
      ))}
      {items.map((item, index) => (
        <AxisLabel key={item.label} x={getX(index)} y={height - 5}>
          {item.label}
        </AxisLabel>
      ))}
    </ChartSvg>
  );
}

function DonutChart({ total, items, centerLabel }) {
  const size = 128;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const palette = [
    chartColors.blue,
    chartColors.orange,
    chartColors.green,
    chartColors.purple,
    chartColors.gray,
    chartColors.red,
  ];
  let offset = 0;

  return (
    <DonutLayout>
      <DonutSvg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx="64" cy="64" r={radius} fill="none" stroke="hsl(220 13% 91%)" strokeWidth="18" />
        {items.map((item, index) => {
          const length = total ? (item.count / total) * circumference : 0;
          const dashOffset = -offset;
          offset += length;
          return (
            <circle
              key={item.label}
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke={palette[index % palette.length]}
              strokeWidth="18"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 64 64)"
            />
          );
        })}
        <text x="64" y="60" textAnchor="middle">
          {formatNumber(total)}
        </text>
        <text x="64" y="78" textAnchor="middle">
          {centerLabel}
        </text>
      </DonutSvg>
      <DonutLegend>
        {items.map((item, index) => (
          <DonutLegendItem key={item.label}>
            <LegendDot $color={palette[index % palette.length]} />
            <span>{item.label}</span>
            <strong>{item.ratio}%</strong>
            <em>{formatNumber(item.count)}</em>
          </DonutLegendItem>
        ))}
      </DonutLegend>
    </DonutLayout>
  );
}

function HeatMap({ items }) {
  const maxValue = Math.max(...items.map((item) => item.count), 1);
  const positions = [
    ["16%", "62%"],
    ["36%", "44%"],
    ["58%", "52%"],
    ["78%", "38%"],
    ["30%", "70%"],
    ["70%", "70%"],
  ];

  return (
    <HeatMapWrap>
      <HeatMapCanvas>
        {items.map((item, index) => (
          <HeatSpot
            key={item.label}
            $left={positions[index % positions.length][0]}
            $top={positions[index % positions.length][1]}
            $size={42 + (item.count / maxValue) * 34}
          >
            <span>{item.label}</span>
          </HeatSpot>
        ))}
      </HeatMapCanvas>
      <HeatScale>
        <span>高</span>
        <i />
        <span>低</span>
      </HeatScale>
    </HeatMapWrap>
  );
}

function TopTable({ columns, rows, progressKey }) {
  return (
    <TopTableWrap>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.rank}-${row.name}`}>
            {columns.map((column) => (
              <td key={column.key}>
                {column.key === progressKey ? (
                  <ProgressCell>
                    <span>{row[column.key]}%</span>
                    <ProgressBar $value={row[column.key]} />
                  </ProgressCell>
                ) : column.key === "risk_level" ? (
                  <RiskPill>{row[column.key]}</RiskPill>
                ) : (
                  row[column.key]
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </TopTableWrap>
  );
}

function StatisticsAnalysis() {
  const [data, setData] = useState(defaultData);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadStatistics() {
      try {
        setIsLoading(true);
        setHasError(false);
        const response = await fetch(`${API_BASE_URL}/statistics/overview`);

        if (!response.ok) {
          throw new Error("Failed to load statistics overview");
        }

        const nextData = await response.json();

        if (isMounted) {
          setData({ ...defaultData, ...nextData });
        }
      } catch {
        if (isMounted) {
          setHasError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStatistics();

    return () => {
      isMounted = false;
    };
  }, []);

  const alarmSpark = normalizeSeries(data.alarm_trend, "general");
  const personSpark = data.person_distribution.map((item) => item.count);
  const deviceSpark = data.device_online_trend.map((item) => item.value);
  const alarmTotal = data.metrics.alarm_count;
  const deviceTotal = data.metrics.device_count;

  return (
    <Wrapper>
      <HeaderRow>
        <PageTitle>统计分析</PageTitle>
      </HeaderRow>

      <MetricGrid>
        {metricCards.map((card, index) => {
          const Icon = card.icon;
          const value = data.metrics[card.key];
          const sparkValues =
            index === 0 || index === 5
              ? alarmSpark
              : index === 1
              ? personSpark
              : deviceSpark;

          return (
            <MetricCard key={card.key}>
              <MetricIcon $color={card.color}>
                <Icon size={20} />
              </MetricIcon>
              <MetricText>
                <MetricTitle>{card.title}</MetricTitle>
                <MetricValue>
                  {isLoading || hasError ? "--" : formatNumber(value)}
                  <span>{card.unit}</span>
                </MetricValue>
                <MetricDelta>较昨日 ↓ {card.delta}</MetricDelta>
              </MetricText>
              <Sparkline values={sparkValues.length ? sparkValues : [1, 2, 1, 3, 2, 4, 3]} color={card.color} />
            </MetricCard>
          );
        })}
      </MetricGrid>

      <Toolbar>
        <FilterButton $active>近7天</FilterButton>
        <FilterButton>近30天</FilterButton>
        <DateRange>
          <CalendarDays size={14} />
          2025-06-24
          <span>→</span>
          2025-06-30
        </DateRange>
        <RefreshButton type="button">
          <RefreshCw size={14} />
          刷新
        </RefreshButton>
      </Toolbar>

      <DashboardGrid>
        <Panel $area="trend">
          <PanelTitle>告警趋势</PanelTitle>
          <MultiLineChart items={data.alarm_trend} />
        </Panel>
        <Panel $area="people">
          <PanelTitle>人员分布</PanelTitle>
          <BarChart items={data.person_distribution} />
        </Panel>
        <Panel $area="online">
          <PanelTitle>设备在线率趋势</PanelTitle>
          <LineChart items={data.device_online_trend} />
        </Panel>
        <Panel $area="alarmType">
          <PanelTitle>告警类型占比</PanelTitle>
          <DonutChart total={alarmTotal} items={data.alarm_type_distribution} centerLabel="总告警数" />
        </Panel>
        <Panel $area="risk">
          <PanelTitle>风险等级占比</PanelTitle>
          <DonutChart total={data.metrics.risk_area_count} items={data.risk_level_distribution} centerLabel="风险区域" />
        </Panel>
        <Panel $area="heat">
          <PanelTitle>风险区域热力</PanelTitle>
          <HeatMap items={data.area_heat} />
        </Panel>
        <Panel $area="duration">
          <PanelTitle>告警处理时长分布（小时）</PanelTitle>
          <DonutChart total={alarmTotal} items={data.alarm_duration_distribution.map((item) => ({ ...item, ratio: alarmTotal ? Math.round((item.count / alarmTotal) * 1000) / 10 : 0 }))} centerLabel="总告警数" />
        </Panel>
        <Panel $area="topDevice">
          <PanelTitle>风险设备 TOP5</PanelTitle>
          <TopTable
            columns={[
              { key: "rank", label: "排名" },
              { key: "name", label: "设备名称" },
              { key: "risk_level", label: "风险等级" },
              { key: "alarm_count", label: "告警次数" },
              { key: "area_name", label: "所属区域" },
            ]}
            rows={data.top_devices}
          />
        </Panel>
        <Panel $area="topArea">
          <PanelTitle>区域告警 TOP5</PanelTitle>
          <TopTable
            columns={[
              { key: "rank", label: "排名" },
              { key: "name", label: "区域名称" },
              { key: "alarm_count", label: "告警次数" },
              { key: "ratio", label: "占比" },
            ]}
            rows={data.top_areas}
            progressKey="ratio"
          />
        </Panel>
        <Panel $area="topPeople">
          <PanelTitle>人员告警 TOP5</PanelTitle>
          <TopTable
            columns={[
              { key: "rank", label: "排名" },
              { key: "name", label: "人员姓名" },
              { key: "alarm_count", label: "告警次数" },
              { key: "department", label: "所属部门" },
            ]}
            rows={data.top_people}
          />
        </Panel>
        <Panel $area="deviceType">
          <PanelTitle>设备类型统计</PanelTitle>
          <DonutChart total={deviceTotal} items={data.device_type_distribution} centerLabel="总设备数" />
        </Panel>
      </DashboardGrid>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  box-sizing: border-box;
  min-height: 100%;
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  gap: 10px;
  padding: 16px 18px;
  background: hsl(216 26% 97%);
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
`;

const PageTitle = styled.h1`
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.peoplePageTitle};
  font-weight: 700;
`;

const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
`;

const MetricCard = styled.article`
  min-width: 0;
  height: 112px;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) 34px;
  gap: 6px 12px;
  border: 1px solid hsl(220 13% 88%);
  border-radius: 8px;
  padding: 14px;
  background: white;
`;

const MetricIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: white;
  background: ${(p) => p.$color};
`;

const MetricText = styled.div`
  min-width: 0;
`;

const MetricTitle = styled.div`
  color: hsl(218 10% 34%);
  font-size: ${FONT_SIZES.dashboardMetricTitle};
  font-weight: 700;
`;

const MetricValue = styled.div`
  margin-top: 4px;
  color: ${COLORS.gray10};
  font-family: var(--font-data);
  font-size: ${FONT_SIZES.dashboardMetricValue};
  font-weight: 800;

  span {
    margin-left: 4px;
    color: hsl(218 10% 45%);
    font-size: ${FONT_SIZES.dashboardMetricUnit};
    font-weight: 600;
  }
`;

const MetricDelta = styled.div`
  margin-top: 4px;
  color: hsl(164 72% 38%);
  font-size: ${FONT_SIZES.dashboardMetricMeta};
  font-weight: 700;
`;

const SparkSvg = styled.svg`
  grid-column: 1 / -1;
  width: 100%;
  height: 34px;

  polyline {
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const Toolbar = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const FilterButton = styled.button`
  height: 30px;
  border: 1px solid hsl(217 93% 82%);
  border-radius: 6px;
  padding: 0 14px;
  color: ${(p) => (p.$active ? chartColors.blue : "hsl(218 10% 38%)")};
  background: ${(p) => (p.$active ? "hsl(217 93% 52% / 0.1)" : "white")};
  font-size: ${FONT_SIZES.dashboardFilter};
  font-weight: 700;
`;

const DateRange = styled.div`
  height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 1px solid hsl(220 13% 86%);
  border-radius: 6px;
  padding: 0 12px;
  color: hsl(218 10% 38%);
  background: white;
  font-size: ${FONT_SIZES.dashboardFilter};
`;

const RefreshButton = styled.button`
  height: 30px;
  border: 1px solid hsl(220 13% 86%);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  color: hsl(218 10% 38%);
  background: white;
  font-size: ${FONT_SIZES.dashboardFilter};
  font-weight: 700;
`;

const DashboardGrid = styled.div`
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 182px;
  gap: 10px;
`;

const Panel = styled.section`
  min-width: 0;
  min-height: 0;
  grid-area: ${(p) => p.$area};
  border: 1px solid hsl(220 13% 88%);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  background: white;

  ${(p) =>
    ({
      trend: "grid-column: span 4;",
      people: "grid-column: span 4;",
      online: "grid-column: span 4;",
      alarmType: "grid-column: span 3;",
      risk: "grid-column: span 2;",
      heat: "grid-column: span 4;",
      duration: "grid-column: span 3;",
      topDevice: "grid-column: span 3;",
      topArea: "grid-column: span 3;",
      topPeople: "grid-column: span 3;",
      deviceType: "grid-column: span 3;",
    }[p.$area])}
`;

const PanelTitle = styled.h2`
  flex: 0 0 auto;
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.dashboardPanelTitle};
  font-weight: 700;
`;

const ChartBox = styled.div`
  min-height: 0;
  flex: 1;
`;

const ChartLegend = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 14px;
  height: 18px;
`;

const LegendItem = styled.span`
  position: relative;
  padding-left: 12px;
  color: hsl(218 10% 42%);
  font-size: ${FONT_SIZES.dashboardChartLegend};

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${(p) => p.$color};
    transform: translateY(-50%);
  }
`;

const ChartSvg = styled.svg`
  width: 100%;
  height: 100%;
  min-height: 0;
`;

const GridLine = styled.line`
  stroke: hsl(220 13% 90%);
  stroke-width: 1;
  stroke-dasharray: 4 5;
`;

const ChartPath = styled.path`
  fill: none;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
`;

const Point = styled.circle`
  r: 3;
`;

const AxisLabel = styled.text`
  fill: hsl(218 10% 45%);
  font-size: ${FONT_SIZES.dashboardAxis};
  font-family: var(--font-data);
  text-anchor: middle;
`;

const BarChartWrap = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
  align-items: end;
  padding-top: 18px;
`;

const BarItem = styled.div`
  min-width: 0;
  height: 100%;
  display: grid;
  grid-template-rows: 18px minmax(0, 1fr) 18px;
  justify-items: center;
  gap: 4px;
`;

const BarValue = styled.div`
  color: hsl(218 10% 35%);
  font-family: var(--font-data);
  font-size: ${FONT_SIZES.dashboardAxis};
`;

const BarColumn = styled.div`
  width: 26px;
  align-self: end;
  height: ${(p) => `${Math.max(p.$height, 4)}%`};
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, hsl(217 93% 64%), hsl(217 93% 52%));
`;

const BarLabel = styled.div`
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: hsl(218 10% 42%);
  font-size: ${FONT_SIZES.dashboardAxis};
`;

const DonutLayout = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
`;

const DonutSvg = styled.svg`
  display: block;

  text:first-of-type {
    fill: ${COLORS.gray10};
    font-family: var(--font-data);
    font-size: ${FONT_SIZES.dashboardMetricValue};
    font-weight: 800;
  }

  text:last-of-type {
    fill: hsl(218 10% 42%);
    font-size: ${FONT_SIZES.dashboardDonutCenterLabel};
  }
`;

const DonutLegend = styled.div`
  min-width: 0;
  display: grid;
  gap: 8px;
`;

const DonutLegendItem = styled.div`
  min-width: 0;
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) 42px 42px;
  align-items: center;
  gap: 7px;
  color: hsl(218 10% 42%);
  font-size: ${FONT_SIZES.dashboardLegendLabel};

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong,
  em {
    color: hsl(218 10% 32%);
    font-family: var(--font-data);
    font-style: normal;
    font-weight: 600;
  }
`;

const LegendDot = styled.i`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(p) => p.$color};
`;

const HeatMapWrap = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 28px;
  gap: 10px;
  align-items: stretch;
`;

const HeatMapCanvas = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: 6px;
  background:
    linear-gradient(90deg, hsl(210 36% 91%) 1px, transparent 1px),
    linear-gradient(hsl(210 36% 91%) 1px, transparent 1px),
    hsl(205 42% 95%);
  background-size: 42px 42px;
`;

const HeatSpot = styled.div`
  position: absolute;
  left: ${(p) => p.$left};
  top: ${(p) => p.$top};
  width: ${(p) => `${p.$size}px`};
  height: ${(p) => `${p.$size}px`};
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: hsl(218 20% 26%);
  font-size: ${FONT_SIZES.dashboardAxis};
  background: radial-gradient(circle, hsl(0 92% 60% / 0.82), hsl(48 96% 55% / 0.62), transparent 68%);
  transform: translate(-50%, -50%);
`;

const HeatScale = styled.div`
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  justify-items: center;
  color: hsl(218 10% 42%);
  font-size: ${FONT_SIZES.dashboardAxis};

  i {
    width: 8px;
    border-radius: 999px;
    background: linear-gradient(180deg, red, yellow, cyan, blue);
  }
`;

const TopTableWrap = styled.table`
  width: 100%;
  margin-top: 8px;
  border-collapse: collapse;
  font-size: ${FONT_SIZES.dashboardAxis};

  th,
  td {
    height: 26px;
    border-bottom: 1px solid hsl(220 13% 91%);
    padding: 0 8px;
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

const RiskPill = styled.span`
  border-radius: 4px;
  padding: 2px 6px;
  color: hsl(0 83% 56%);
  background: hsl(0 83% 60% / 0.1);
  font-weight: 700;
`;

const ProgressCell = styled.div`
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
`;

const ProgressBar = styled.div`
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    ${chartColors.blue} ${(p) => p.$value}%,
    hsl(220 13% 90%) ${(p) => p.$value}%
  );
`;

export default StatisticsAnalysis;
