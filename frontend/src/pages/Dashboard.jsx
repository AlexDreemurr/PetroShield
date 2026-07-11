import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import Icon from "../components/Icon/Icon";
import { COLORS } from "../constants/STYLES";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

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
    icon: "Cpu",
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
    unit: "个",
    icon: "ShieldAlert",
    tone: "amber",
  },
];

const personStatusConfig = [
  { key: "normal", label: "正常", color: "hsl(152 70% 34%)" },
  { key: "high_risk", label: "高风险", color: "hsl(0 74% 48%)" },
  { key: "medium_risk", label: "中风险", color: "hsl(38 92% 42%)" },
  { key: "offline", label: "离线", color: "hsl(218 10% 58%)" },
];

const deviceStatusConfig = [
  { key: "online", label: "在线", color: "hsl(152 70% 34%)" },
  { key: "offline", label: "离线", color: "hsl(218 10% 58%)" },
  { key: "alarm", label: "告警", color: "hsl(0 74% 48%)" },
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
      <CardHint>{hasError ? "数据获取失败" : ""}</CardHint>
    </CardWrapper>
  );
}

function DonutChart({ items }) {
  const size = 136;
  const strokeWidth = 18;
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
      {total > 0 &&
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
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={segmentOffset}
              transform={`rotate(-90 ${center} ${center})`}
            />
          );
        })}
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
    [config, distribution],
  );

  const shouldShowValue = !isLoading && !hasError;

  return (
    <DistributionWrapper>
      <DistributionTitle>{title}</DistributionTitle>
      <DistributionBody>
        <DonutFrame>
          <DonutChart items={shouldShowValue ? items : emptyDistribution(items)} />
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
      <DistributionHint>{hasError ? "数据获取失败" : ""}</DistributionHint>
    </DistributionWrapper>
  );
}

function emptyDistribution(items) {
  return items.map((item) => ({ ...item, count: 0, ratio: 0 }));
}

function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

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

    loadMetrics();
    const intervalId = window.setInterval(loadMetrics, 30000);

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
      <DistributionGrid>
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
      </DistributionGrid>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  min-height: 100%;
  background-color: hsl(0 0% 97.5%);
  padding: 8px;
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const CardWrapper = styled.article`
  min-height: 132px;
  border: 1px solid hsl(220 13% 90%);
  border-radius: 8px;
  background: hsl(0 0% 100%);
  padding: 16px;
`;

const CardTopLine = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const CardTitle = styled.p`
  font-size: ${13 / 16}rem;
  font-weight: 500;
`;

const IconBadge = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 100%;
  display: grid;
  place-items: center;
  color: white;
  background: ${(p) => toneColors[p.$tone].text};
`;

const MetricLine = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 18px;
`;

const MetricValue = styled.div`
  color: ${COLORS.gray10};
  font-family: var(--font-data);
  font-size: ${30 / 16}rem;
  font-weight: 600;
`;

const MetricUnit = styled.div`
  color: hsl(218 10% 45%);
  font-size: ${13 / 16}rem;
`;

const CardHint = styled.p`
  margin-top: 8px;
  color: hsl(218 10% 55%);
  font-size: ${12 / 16}rem;
`;

const DistributionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(280px, 360px));
  gap: 8px;
  margin-top: 8px;
  justify-content: start;

  @media (max-width: 820px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const DistributionWrapper = styled.article`
  min-height: 230px;
  border: 1px solid hsl(220 13% 90%);
  border-radius: 8px;
  background: hsl(0 0% 100%);
  padding: 16px;
`;

const DistributionTitle = styled.h2`
  color: ${COLORS.gray10};
  font-size: ${14 / 16}rem;
  font-weight: 600;
`;

const DistributionBody = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 18px;
`;

const DonutFrame = styled.div`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
`;

const DonutSvg = styled.svg`
  display: block;
`;

const LegendList = styled.ul`
  flex: 1;
  display: grid;
  gap: 12px;
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
  gap: 8px;
  margin-top: 3px;
  color: ${COLORS.gray10};
  font-family: var(--font-data);
  font-size: ${14 / 16}rem;
  font-weight: 600;
`;

const LegendRatio = styled.span`
  color: hsl(218 10% 50%);
  font-size: ${11 / 16}rem;
  font-weight: 500;
`;

const DistributionHint = styled.p`
  min-height: 16px;
  margin-top: 10px;
  color: hsl(218 10% 55%);
  font-size: ${12 / 16}rem;
`;

const toneColors = {
  blue: {
    text: COLORS.blue,
    background: "hsl(220 90% 50% / 0.1)",
  },
  green: {
    text: "hsl(152 70% 34%)",
    background: "hsl(152 70% 34% / 0.1)",
  },
  amber: {
    text: "hsl(38 92% 42%)",
    background: "hsl(38 92% 42% / 0.12)",
  },
  red: {
    text: "hsl(0 74% 48%)",
    background: "hsl(0 74% 48% / 0.1)",
  },
};

export default Dashboard;
