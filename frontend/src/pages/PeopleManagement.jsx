import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import PeopleLocationMap from "../components/PeopleLocationMap/PeopleLocationMap";
import { COLORS, FONT_SIZES } from "../constants/STYLES";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

function formatTime(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function getDisplayStatus(status) {
  if (status === "离线") {
    return "离线";
  }

  if (["异常", "风险", "禁止进入"].includes(status)) {
    return "告警";
  }

  return "在线";
}

function getStatusTone(status) {
  if (status === "离线") {
    return "gray";
  }

  if (["异常", "风险", "禁止进入"].includes(status)) {
    return "red";
  }

  return "green";
}

function getLocationSource(person) {
  return (
    person.latest_position?.source ??
    person.device_type ??
    (person.location_zone ? "区域快照" : "--")
  );
}

function getLocationConfidence(person) {
  const confidence = person.latest_position?.confidence;

  return confidence == null ? "--" : `${Math.round(confidence * 100)}%`;
}

function personMatchesSearch(person, keyword) {
  if (!keyword.trim()) {
    return true;
  }

  const normalizedKeyword = keyword.trim().toLowerCase();

  return [
    person.name,
    person.id,
    person.id_card,
    person.department,
    person.type,
    person.position,
    person.company,
    person.location_zone,
    person.device_id,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedKeyword));
}

function DetailField({ label, value }) {
  return (
    <DetailItem>
      <DetailLabel>{label}</DetailLabel>
      <DetailValue>{value ?? "--"}</DetailValue>
    </DetailItem>
  );
}

function SelectedPersonCard({ person, onViewDetail }) {
  if (!person) {
    return (
      <SelectedCard>
        <EmptySelection>请在地图上选择一个人员</EmptySelection>
      </SelectedCard>
    );
  }

  return (
    <SelectedCard>
      <SelectedHeader>
        <Avatar>{person.name?.slice(0, 1) ?? "人"}</Avatar>
        <SelectedIdentity>
          <SelectedName>{person.name}</SelectedName>
          <SelectedMeta>
            {person.id_card || person.id} / {person.type}
          </SelectedMeta>
        </SelectedIdentity>
        <StatusBadge $tone={getStatusTone(person.status)}>
          {getDisplayStatus(person.status)}
        </StatusBadge>
      </SelectedHeader>

      <SelectedFields>
        <DetailField label="所属部门" value={person.department} />
        <DetailField label="所在区域" value={person.location_zone} />
        <DetailField label="当前位置" value={person.location_zone} />
        <DetailField label="定位来源" value={getLocationSource(person)} />
        <DetailField label="定位置信度" value={getLocationConfidence(person)} />
        <DetailField
          label="最近更新时间"
          value={formatTime(
            person.latest_position?.timestamp ?? person.last_active_time
          )}
        />
      </SelectedFields>

      <CardActions>
        <PrimaryButton type="button" onClick={() => onViewDetail(person)}>
          查看详情
        </PrimaryButton>
      </CardActions>
    </SelectedCard>
  );
}

function PersonDetailModal({ person, onClose }) {
  if (!person) {
    return null;
  }

  return (
    <ModalBackdrop onMouseDown={onClose}>
      <ModalPanel onMouseDown={(event) => event.stopPropagation()}>
        <ModalHeader>
          <div>
            <ModalTitle>{person.name}</ModalTitle>
            <ModalSubtitle>
              {person.type} / {person.department ?? person.company ?? "--"}
            </ModalSubtitle>
          </div>
          <CloseButton type="button" onClick={onClose}>
            ×
          </CloseButton>
        </ModalHeader>

        <ModalGrid>
          <ModalSection>
            <ModalSectionTitle>基础信息</ModalSectionTitle>
            <DetailField label="人员ID" value={person.id} />
            <DetailField label="工号/证件" value={person.id_card} />
            <DetailField label="性别" value={person.gender} />
            <DetailField label="岗位" value={person.position} />
            <DetailField label="所属单位" value={person.company} />
            <DetailField label="联系方式" value={person.phone} />
          </ModalSection>

          <ModalSection>
            <ModalSectionTitle>定位信息</ModalSectionTitle>
            <DetailField label="当前区域" value={person.location_zone} />
            <DetailField label="定位来源" value={getLocationSource(person)} />
            <DetailField
              label="定位置信度"
              value={getLocationConfidence(person)}
            />
            <DetailField
              label="定位坐标"
              value={
                person.latest_position
                  ? `x:${person.latest_position.x}, y:${
                      person.latest_position.y
                    }, z:${person.latest_position.z ?? "--"}`
                  : "--"
              }
            />
            <DetailField
              label="定位时间"
              value={formatTime(person.latest_position?.timestamp)}
            />
            <DetailField
              label="速度/方向"
              value={
                person.latest_position
                  ? `${person.latest_position.speed ?? "--"} / ${
                      person.latest_position.direction ?? "--"
                    }`
                  : "--"
              }
            />
          </ModalSection>

          <ModalSection>
            <ModalSectionTitle>准入与培训</ModalSectionTitle>
            <DetailField label="人员状态" value={person.status} />
            <DetailField label="风险等级" value={person.risk_level} />
            <DetailField label="通行状态" value={person.access_status} />
            <DetailField label="安全标签" value={person.safety_tag} />
            <DetailField label="培训状态" value={person.training_status} />
            <DetailField label="培训评分" value={person.training_score} />
            <DetailField
              label="最近培训"
              value={formatTime(person.last_training_time)}
            />
            <DetailField label="证书状态" value={person.certificate_status} />
          </ModalSection>

          <ModalSection>
            <ModalSectionTitle>健康与安全</ModalSectionTitle>
            <DetailField label="健康状态" value={person.health_status} />
            <DetailField label="健康风险" value={person.health_risk_level} />
            <DetailField
              label="最近体检"
              value={formatTime(person.last_medical_check)}
            />
            <DetailField
              label="职业病风险"
              value={person.occupational_disease_flag ? "是" : "否"}
            />
            <DetailField label="暴露等级" value={person.exposure_level} />
            <DetailField label="安全积分" value={person.safety_score} />
            <DetailField label="违规次数" value={person.violation_count} />
            <DetailField label="未遂上报" value={person.near_miss_count} />
          </ModalSection>
        </ModalGrid>
      </ModalPanel>
    </ModalBackdrop>
  );
}

function PeopleManagement() {
  const [people, setPeople] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [modalPerson, setModalPerson] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPeople() {
      try {
        setIsLoading(true);
        setHasError(false);
        const response = await fetch(`${API_BASE_URL}/people/locations`);

        if (!response.ok) {
          throw new Error("Failed to load people locations");
        }

        const data = await response.json();

        if (isMounted) {
          setPeople(data.items ?? []);
        }
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setHasError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPeople();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredPeople = useMemo(
    () => people.filter((person) => personMatchesSearch(person, searchKeyword)),
    [people, searchKeyword]
  );

  const selectedPerson = useMemo(
    () => people.find((person) => person.id === selectedPersonId) ?? null,
    [people, selectedPersonId]
  );

  const statusMessage = isLoading
    ? "人员定位数据加载中..."
    : hasError
    ? "人员定位数据加载失败"
    : filteredPeople.length === 0
    ? "没有匹配的人员"
    : null;

  return (
    <PageShell>
      <PageHeader>
        <div>
          <PageTitle>人员管理</PageTitle>
        </div>
        <SearchInput
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          placeholder="搜索姓名、工号、部门、区域"
        />
      </PageHeader>

      <LocationPanel>
        <PeopleLocationMap
          people={filteredPeople}
          selectedPersonId={selectedPersonId}
          onPersonSelect={(person) => setSelectedPersonId(person.id)}
        />
        <SelectedPersonCard
          person={selectedPerson}
          onViewDetail={setModalPerson}
        />
      </LocationPanel>

      <ListPanel>
        <ListHeader>
          <ListTitle>人员列表</ListTitle>
          <ListCount>
            共 {people.length} 人，当前显示 {filteredPeople.length} 人
          </ListCount>
        </ListHeader>

        <TableWrap>
          <PeopleTable>
            <thead>
              <tr>
                <th>姓名</th>
                <th>工号</th>
                <th>人员类型</th>
                <th>所属部门</th>
                <th>状态</th>
                <th>所在区域</th>
                <th>最近更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {statusMessage ? (
                <tr>
                  <EmptyCell colSpan="8">{statusMessage}</EmptyCell>
                </tr>
              ) : (
                filteredPeople.map((person) => (
                  <tr
                    key={person.id}
                    data-selected={person.id === selectedPersonId}
                    onClick={() => setSelectedPersonId(person.id)}
                  >
                    <td>{person.name}</td>
                    <td>{person.id_card || person.id}</td>
                    <td>{person.type}</td>
                    <td>{person.department ?? "--"}</td>
                    <td>
                      <StatusInline $tone={getStatusTone(person.status)}>
                        {getDisplayStatus(person.status)}
                      </StatusInline>
                    </td>
                    <td>{person.location_zone ?? "--"}</td>
                    <td>
                      {formatTime(
                        person.latest_position?.timestamp ??
                          person.last_active_time
                      )}
                    </td>
                    <td>
                      <ViewButton
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedPersonId(person.id);
                          setModalPerson(person);
                        }}
                      >
                        查看
                      </ViewButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </PeopleTable>
        </TableWrap>
      </ListPanel>

      <PersonDetailModal
        person={modalPerson}
        onClose={() => setModalPerson(null)}
      />
    </PageShell>
  );
}

const PageShell = styled.div`
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 11fr) minmax(0, 9fr);
  gap: 10px;
  overflow: hidden;
  padding: 10px 12px;
  background: hsl(216 26% 97%);
`;

const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
`;

const PageTitle = styled.h1`
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.peoplePageTitle};
  font-weight: 700;
`;

const SearchInput = styled.input`
  width: min(360px, 44vw);
  height: 34px;
  border: 1px solid hsl(220 13% 84%);
  border-radius: 6px;
  padding: 0 12px;
  color: hsl(218 15% 24%);
  background: white;
  font-size: ${FONT_SIZES.input};
  outline: none;

  &:focus {
    border-color: hsl(214 92% 56%);
    box-shadow: 0 0 0 3px hsl(214 92% 56% / 0.12);
  }
`;

const LocationPanel = styled.section`
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(280px, 3fr);
  gap: 10px;
`;

const SelectedCard = styled.aside`
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid hsl(220 13% 88%);
  border-radius: 8px;
  background: white;
  padding: 14px;
  overflow: hidden;
`;

const EmptySelection = styled.div`
  flex: 1;
  display: grid;
  place-items: center;
  color: hsl(218 10% 54%);
  font-size: ${FONT_SIZES.peopleEmptyText};
  text-align: center;
`;

const SelectedHeader = styled.div`
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
`;

const Avatar = styled.div`
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: 100%;
  color: white;
  background: linear-gradient(135deg, hsl(214 92% 56%), hsl(199 88% 48%));
  font-size: ${FONT_SIZES.peopleAvatarText};
  font-weight: 700;
`;

const SelectedIdentity = styled.div`
  min-width: 0;
`;

const SelectedName = styled.h2`
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.peopleSelectedName};
  font-weight: 700;
`;

const SelectedMeta = styled.p`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 4px;
  color: hsl(218 10% 48%);
  font-size: ${FONT_SIZES.peopleMeta};
`;

const StatusBadge = styled.span`
  padding: 4px 8px;
  border-radius: 999px;
  color: ${(p) =>
    ({
      green: "hsl(152 70% 32%)",
      red: "hsl(0 76% 48%)",
      gray: "hsl(218 10% 46%)",
    }[p.$tone])};
  background: ${(p) =>
    ({
      green: "hsl(152 70% 42% / 0.12)",
      red: "hsl(0 76% 56% / 0.12)",
      gray: "hsl(218 10% 55% / 0.12)",
    }[p.$tone])};
  font-size: ${FONT_SIZES.peopleBadge};
  font-weight: 700;
`;

const SelectedFields = styled.div`
  display: grid;
  gap: 9px;
  margin-top: 14px;
`;

const DetailItem = styled.div`
  min-width: 0;
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: 10px;
  align-items: baseline;
`;

const DetailLabel = styled.div`
  color: hsl(218 10% 54%);
  font-size: ${FONT_SIZES.peopleDetailLabel};
`;

const DetailValue = styled.div`
  min-width: 0;
  overflow-wrap: anywhere;
  color: hsl(218 15% 24%);
  font-size: ${FONT_SIZES.peopleDetailValue};
  font-weight: 600;
`;

const CardActions = styled.div`
  margin-top: auto;
  padding-top: 20px;
`;

const PrimaryButton = styled.button`
  width: 100%;
  height: 36px;
  border: 0;
  border-radius: 6px;
  color: white;
  background: hsl(214 92% 56%);
  font-weight: 700;
  cursor: pointer;

  &:hover {
    background: hsl(214 92% 48%);
  }
`;

const ListPanel = styled.section`
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border: 1px solid hsl(220 13% 88%);
  border-radius: 8px;
  background: white;
  padding: 5px 10px 10px;
  overflow: hidden;
`;

const ListHeader = styled.div`
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 4px;
`;

const ListTitle = styled.h2`
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.peopleListTitle};
  font-weight: 700;
`;

const ListCount = styled.span`
  color: hsl(218 10% 50%);
  font-size: ${FONT_SIZES.peopleDetailLabel};
`;

const TableWrap = styled.div`
  min-height: 0;
  overflow: auto;
`;

const PeopleTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;

  th,
  td {
    height: 32px;
    border-bottom: 1px solid hsl(220 13% 92%);
    padding: 0 10px;
    text-align: left;
    color: hsl(218 15% 24%);
    font-size: ${FONT_SIZES.peopleTable};
    white-space: nowrap;
  }

  th {
    position: sticky;
    top: 0;
    z-index: 1;
    color: hsl(218 10% 44%);
    background: hsl(216 26% 98%);
    font-weight: 700;
  }

  tbody tr {
    cursor: pointer;
  }

  tbody tr:hover,
  tbody tr[data-selected="true"] {
    background: hsl(214 92% 56% / 0.07);
  }
`;

const StatusInline = styled.span`
  position: relative;
  padding-left: 12px;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: 7px;
    height: 7px;
    border-radius: 100%;
    background: ${(p) =>
      ({
        green: "hsl(152 70% 42%)",
        red: "hsl(0 76% 58%)",
        gray: "hsl(218 10% 58%)",
      }[p.$tone])};
    transform: translateY(-50%);
  }
`;

const ViewButton = styled.button`
  border: 0;
  color: hsl(214 92% 48%);
  background: transparent;
  font-weight: 700;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`;

const EmptyCell = styled.td`
  height: 96px;
  text-align: center !important;
  color: hsl(218 10% 54%) !important;
`;

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 18px;
  background: hsl(220 20% 10% / 0.38);
`;

const ModalPanel = styled.div`
  width: min(980px, 100%);
  max-height: min(760px, 92vh);
  overflow: auto;
  border-radius: 8px;
  background: white;
  box-shadow: 0 24px 70px hsl(220 20% 10% / 0.22);
`;

const ModalHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid hsl(220 13% 90%);
  padding: 16px 18px;
  background: white;
`;

const ModalTitle = styled.h2`
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.peopleModalTitle};
  font-weight: 700;
`;

const ModalSubtitle = styled.p`
  margin-top: 4px;
  color: hsl(218 10% 50%);
  font-size: ${FONT_SIZES.peopleDetailLabel};
`;

const CloseButton = styled.button`
  width: 32px;
  height: 32px;
  border: 1px solid hsl(220 13% 86%);
  border-radius: 6px;
  color: hsl(218 15% 24%);
  background: white;
  font-size: ${FONT_SIZES.peopleCloseButton};
  cursor: pointer;
`;

const ModalGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  padding: 18px;
`;

const ModalSection = styled.section`
  min-width: 0;
  display: grid;
  gap: 10px;
  border: 1px solid hsl(220 13% 90%);
  border-radius: 8px;
  padding: 12px;
`;

const ModalSectionTitle = styled.h3`
  margin-bottom: 2px;
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.peopleModalSectionTitle};
  font-weight: 700;
`;

export default PeopleManagement;
