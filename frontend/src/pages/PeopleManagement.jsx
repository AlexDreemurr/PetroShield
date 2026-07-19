import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router";
import styled from "styled-components";
import { dictionaryLabel, useRuntimeDictionaries } from "../services/runtimeDictionaries";
import PeopleLocationMap from "../components/PeopleLocationMap/PeopleLocationMap";
import { getCachedJson, loadCachedJson, PAGE_DATA_URLS } from "../services/pageDataCache";
import { BUSINESS_PAGE_LAYOUT, COLORS, FONT_SIZES } from "../constants/STYLES";

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

  if (["异常", "风险", "禁止进入", "告警"].includes(status)) {
    return "告警";
  }

  return "在线";
}

function getStatusTone(status) {
  if (status === "离线") {
    return "gray";
  }

  if (["异常", "风险", "禁止进入", "告警"].includes(status)) {
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

function getPersonWorkId(person) {
  return person.id_card || person.id || "--";
}

function getPersonUpdateTime(person) {
  return person.latest_position?.timestamp ?? person.last_active_time;
}

function parseLocalDateTime(value) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : null;
}

function getColumnValue(person, key) {
  const valueMap = {
    name: person.name,
    workId: getPersonWorkId(person),
    type: person.type,
    department: person.department,
    status: getDisplayStatus(person.status),
    locationZone: person.location_zone,
    updateTime: getPersonUpdateTime(person),
  };

  return valueMap[key] ?? "--";
}

const PERSON_TABLE_COLUMNS = [
  { key: "name", label: "姓名" },
  { key: "workId", label: "工号" },
  { key: "type", label: "人员类型" },
  { key: "department", label: "所属部门" },
  { key: "status", label: "状态" },
  { key: "locationZone", label: "所在区域" },
  { key: "updateTime", label: "最近更新时间" },
];

const TEXT_SEARCH_COLUMNS = new Set(["name", "workId"]);

function getPersonSurname(name) {
  const normalizedName = String(name ?? "").trim();

  return normalizedName ? normalizedName.slice(0, 1) : "--";
}

function getColumnOptions(people, columnKey) {
  if (columnKey === "name") {
    return Array.from(
      new Set(people.map((person) => getPersonSurname(person.name)))
    ).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }

  return Array.from(
    new Set(
      people.map((person) => String(getColumnValue(person, columnKey) ?? "--"))
    )
  ).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function applyColumnFilters(people, filters) {
  return people.filter((person) =>
    Object.entries(filters).every(([columnKey, filter]) => {
      if (!filter) {
        return true;
      }

      if (columnKey === "name") {
        const name = String(getColumnValue(person, columnKey) ?? "");
        const searchText = filter.search?.trim().toLowerCase();
        const surname = getPersonSurname(name);
        const matchesSearch =
          !searchText || name.toLowerCase().includes(searchText);
        const matchesSurname =
          !filter.values?.length || filter.values.includes(surname);

        return matchesSearch && matchesSurname;
      }

      if (columnKey === "workId") {
        const searchText = filter.search?.trim().toLowerCase();

        return (
          !searchText ||
          String(getColumnValue(person, columnKey) ?? "")
            .toLowerCase()
            .includes(searchText)
        );
      }

      if (columnKey === "updateTime") {
        const valueTime = new Date(getColumnValue(person, columnKey)).getTime();
        const startTime = parseLocalDateTime(filter.start);
        const endTime = parseLocalDateTime(filter.end);

        if (!Number.isFinite(valueTime)) {
          return false;
        }

        return (
          (!Number.isFinite(startTime) || valueTime >= startTime) &&
          (!Number.isFinite(endTime) || valueTime <= endTime)
        );
      }

      if (!filter.values?.length) {
        return true;
      }

      return filter.values.includes(String(getColumnValue(person, columnKey)));
    })
  );
}

function isColumnFiltered(filter) {
  return Boolean(
    filter?.search?.trim() ||
      filter?.start ||
      filter?.end ||
      filter?.values?.length
  );
}

function sortPeople(people, sortConfig) {
  if (!sortConfig?.key || !sortConfig.direction) {
    return people;
  }

  return [...people].sort((personA, personB) => {
    const valueA = getColumnValue(personA, sortConfig.key);
    const valueB = getColumnValue(personB, sortConfig.key);
    const normalizedA =
      sortConfig.key === "updateTime" ? new Date(valueA).getTime() : valueA;
    const normalizedB =
      sortConfig.key === "updateTime" ? new Date(valueB).getTime() : valueB;
    const result =
      typeof normalizedA === "number" && typeof normalizedB === "number"
        ? normalizedA - normalizedB
        : String(normalizedA ?? "").localeCompare(
            String(normalizedB ?? ""),
            "zh-CN",
            { numeric: true }
          );

    return sortConfig.direction === "asc" ? result : -result;
  });
}

function ColumnFilterDropdown({
  column,
  options,
  filter,
  sortDirection,
  onToggleValue,
  onSelectAll,
  onClearFilter,
  onSearchChange,
  onDateRangeChange,
  onSort,
  onClose,
  anchorRect,
}) {
  const selectedValues = filter?.values ?? [];
  const isTextSearchColumn = TEXT_SEARCH_COLUMNS.has(column.key);
  const isDateRangeColumn = column.key === "updateTime";
  const shouldShowSort = !isTextSearchColumn;
  const shouldShowOptions = !isDateRangeColumn && column.key !== "workId";
  const popover = (
    <FilterPopoverLayer onMouseDown={onClose}>
      <FilterPopover
        $top={anchorRect.bottom + 4}
        $left={anchorRect.left}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <FilterPopoverHeader>
          <strong>{column.label}</strong>
          <CloseFilterButton type="button" onClick={onClose}>
            ×
          </CloseFilterButton>
        </FilterPopoverHeader>

        {shouldShowSort ? (
          <SortActions>
            <SortButton
              type="button"
              data-active={sortDirection === "asc"}
              onClick={() => onSort("asc")}
            >
              升序
            </SortButton>
            <SortButton
              type="button"
              data-active={sortDirection === "desc"}
              onClick={() => onSort("desc")}
            >
              降序
            </SortButton>
            <SortButton type="button" onClick={() => onSort(null)}>
              取消排序
            </SortButton>
          </SortActions>
        ) : null}

        {isTextSearchColumn ? (
          <FilterSearchInput
            value={filter?.search ?? ""}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={`搜索${column.label}`}
          />
        ) : null}

        {isDateRangeColumn ? (
          <DateRangeFields>
            <label>
              <span>开始</span>
              <input
                type="datetime-local"
                value={filter?.start ?? ""}
                onChange={(event) =>
                  onDateRangeChange({ start: event.target.value })
                }
              />
            </label>
            <label>
              <span>结束</span>
              <input
                type="datetime-local"
                value={filter?.end ?? ""}
                onChange={(event) =>
                  onDateRangeChange({ end: event.target.value })
                }
              />
            </label>
          </DateRangeFields>
        ) : null}

        <FilterToolbar>
          {shouldShowOptions ? (
            <button type="button" onClick={onSelectAll}>
              全选
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={onClearFilter}>
            清空
          </button>
        </FilterToolbar>

        {shouldShowOptions ? (
          <FilterOptionList>
            {options.map((option) => (
              <FilterOption key={option}>
                <input
                  type="checkbox"
                  checked={
                    selectedValues.length === 0 ||
                    selectedValues.includes(option)
                  }
                  onChange={() => onToggleValue(option)}
                />
                <span>{option}</span>
              </FilterOption>
            ))}
          </FilterOptionList>
        ) : null}
      </FilterPopover>
    </FilterPopoverLayer>
  );

  return createPortal(popover, document.body);
}

function DetailField({ label, value }) {
  return (
    <DetailItem>
      <DetailLabel>{label}</DetailLabel>
      <DetailValue>{value ?? "--"}</DetailValue>
    </DetailItem>
  );
}

function SelectedPersonCard({
  person,
  onViewDetail,
  showTrack,
  onToggleTrack,
}) {
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
          <SelectedNameRow>
            <SelectedName>{person.name}</SelectedName>
            <StatusBadge $tone={getStatusTone(person.status)}>
              {getDisplayStatus(person.status)}
            </StatusBadge>
          </SelectedNameRow>
          <SelectedMeta>工号：{getPersonWorkId(person)}</SelectedMeta>
          <SelectedMeta>部门：{person.department ?? "--"}</SelectedMeta>
        </SelectedIdentity>
      </SelectedHeader>

      <SelectedFields>
        <DetailField label="当前状态" value={getDisplayStatus(person.status)} />
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
        <PrimaryButton
          type="button"
          data-active={showTrack}
          onClick={onToggleTrack}
        >
          查看轨迹
        </PrimaryButton>
        <SecondaryButton type="button">呼叫对讲</SecondaryButton>
        <SecondaryButton type="button" onClick={() => onViewDetail(person)}>
          更多
        </SecondaryButton>
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
              <PersonTypeLabel value={person.type} /> / {person.department ?? person.company ?? "--"}
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
  const [searchParams] = useSearchParams();
  const initialPayload = getCachedJson(PAGE_DATA_URLS.people);
  const [people, setPeople] = useState(() => initialPayload?.items ?? []);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState(
    () => searchParams.get("person_id") || null
  );
  const [modalPerson, setModalPerson] = useState(null);
  const [isLoading, setIsLoading] = useState(() => !initialPayload);
  const [hasError, setHasError] = useState(false);
  const [columnFilters, setColumnFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [activeFilterKey, setActiveFilterKey] = useState(null);
  const [activeFilterRect, setActiveFilterRect] = useState(null);
  const [showTrack, setShowTrack] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPeople() {
      const cachedPayload = getCachedJson(PAGE_DATA_URLS.people);
      if (cachedPayload) {
        setPeople(cachedPayload.items ?? []);
        setIsLoading(false);
      }
      try {
        setIsLoading(!cachedPayload);
        setHasError(false);
        const data = await loadCachedJson(PAGE_DATA_URLS.people, {
          force: Boolean(cachedPayload),
        });

        if (isMounted) {
          setPeople(data.items ?? []);
        }
      } catch (error) {
        console.error(error);
        if (isMounted && !cachedPayload) {
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

  useEffect(() => {
    const requestedPersonId = searchParams.get("person_id");
    if (
      requestedPersonId &&
      people.some((person) => person.id === requestedPersonId)
    ) {
      setSelectedPersonId(requestedPersonId);
    }
  }, [people, searchParams]);

  useEffect(() => {
    if (!activeFilterKey) {
      return undefined;
    }

    function closeActiveFilter() {
      setActiveFilterKey(null);
      setActiveFilterRect(null);
    }

    window.addEventListener("resize", closeActiveFilter);
    return () => {
      window.removeEventListener("resize", closeActiveFilter);
    };
  }, [activeFilterKey]);

  const searchedPeople = useMemo(
    () => people.filter((person) => personMatchesSearch(person, searchKeyword)),
    [people, searchKeyword]
  );

  const filteredPeople = useMemo(
    () => applyColumnFilters(searchedPeople, columnFilters),
    [searchedPeople, columnFilters]
  );

  const displayedPeople = useMemo(
    () => sortPeople(filteredPeople, sortConfig),
    [filteredPeople, sortConfig]
  );

  const selectedPerson = useMemo(
    () => people.find((person) => person.id === selectedPersonId) ?? null,
    [people, selectedPersonId]
  );

  const statusMessage = isLoading
    ? "人员定位数据加载中..."
    : hasError
    ? "人员定位数据加载失败"
    : displayedPeople.length === 0
    ? "没有匹配的人员"
    : null;

  function handleToggleFilterValue(columnKey, option, options) {
    setColumnFilters((currentFilters) => {
      const currentFilter = currentFilters[columnKey] ?? {};
      const currentValues = currentFilter.values ?? options;
      const nextValues = currentValues.includes(option)
        ? currentValues.filter((value) => value !== option)
        : [...currentValues, option];

      if (nextValues.length === 0 || nextValues.length === options.length) {
        const nextFilter = { ...currentFilter };
        delete nextFilter.values;

        if (isColumnFiltered(nextFilter)) {
          return {
            ...currentFilters,
            [columnKey]: nextFilter,
          };
        }

        const { [columnKey]: _removed, ...restFilters } = currentFilters;
        return restFilters;
      }

      return {
        ...currentFilters,
        [columnKey]: {
          ...currentFilter,
          values: nextValues,
        },
      };
    });
  }

  function handleSelectAll(columnKey) {
    setColumnFilters((currentFilters) => {
      const nextFilter = { ...(currentFilters[columnKey] ?? {}) };
      delete nextFilter.values;

      if (isColumnFiltered(nextFilter)) {
        return {
          ...currentFilters,
          [columnKey]: nextFilter,
        };
      }

      const { [columnKey]: _removed, ...restFilters } = currentFilters;
      return restFilters;
    });
  }

  function handleClearFilter(columnKey) {
    setColumnFilters((currentFilters) => {
      const { [columnKey]: _removed, ...restFilters } = currentFilters;
      return restFilters;
    });
  }

  function handleSearchFilterChange(columnKey, search) {
    setColumnFilters((currentFilters) => {
      const nextFilter = {
        ...(currentFilters[columnKey] ?? {}),
        search,
      };

      if (!isColumnFiltered(nextFilter)) {
        const { [columnKey]: _removed, ...restFilters } = currentFilters;
        return restFilters;
      }

      return {
        ...currentFilters,
        [columnKey]: nextFilter,
      };
    });
  }

  function handleDateRangeFilterChange(columnKey, rangePatch) {
    setColumnFilters((currentFilters) => {
      const nextFilter = {
        ...(currentFilters[columnKey] ?? {}),
        ...rangePatch,
      };

      if (!isColumnFiltered(nextFilter)) {
        const { [columnKey]: _removed, ...restFilters } = currentFilters;
        return restFilters;
      }

      return {
        ...currentFilters,
        [columnKey]: nextFilter,
      };
    });
  }

  function handleSort(columnKey, direction) {
    setSortConfig(
      direction ? { key: columnKey, direction } : { key: null, direction: null }
    );
  }

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
          people={displayedPeople}
          selectedPersonId={selectedPersonId}
          showTrack={showTrack}
          isDataLoading={isLoading}
          hasDataError={hasError}
          onPersonSelect={(person) => setSelectedPersonId(person.id)}
        />
        <SelectedPersonCard
          person={selectedPerson}
          showTrack={showTrack}
          onToggleTrack={() => setShowTrack((value) => !value)}
          onViewDetail={setModalPerson}
        />
      </LocationPanel>

      <ListPanel>
        <ListHeader>
          <ListTitle>人员列表</ListTitle>
          <ListCount>
            共 {people.length} 人，当前显示 {displayedPeople.length} 人
          </ListCount>
        </ListHeader>

        <TableWrap>
          <PeopleTable>
            <thead>
              <tr>
                {PERSON_TABLE_COLUMNS.map((column) => {
                  const options = getColumnOptions(searchedPeople, column.key);
                  const filter = columnFilters[column.key];
                  const isActive = activeFilterKey === column.key;
                  const isFiltered = isColumnFiltered(filter);
                  const sortDirection =
                    sortConfig.key === column.key ? sortConfig.direction : null;

                  return (
                    <th key={column.key}>
                      <HeaderFilterButton
                        type="button"
                        data-active={isFiltered || Boolean(sortDirection)}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (isActive) {
                            setActiveFilterKey(null);
                            setActiveFilterRect(null);
                          } else {
                            setActiveFilterKey(column.key);
                            setActiveFilterRect(
                              event.currentTarget.getBoundingClientRect()
                            );
                          }
                        }}
                      >
                        <span>{column.label}</span>
                        <span>
                          {sortDirection === "asc"
                            ? "↑"
                            : sortDirection === "desc"
                            ? "↓"
                            : "▾"}
                        </span>
                      </HeaderFilterButton>
                      {isActive && activeFilterRect ? (
                        <ColumnFilterDropdown
                          column={column}
                          options={options}
                          filter={filter}
                          sortDirection={sortDirection}
                          onToggleValue={(option) =>
                            handleToggleFilterValue(column.key, option, options)
                          }
                          onSelectAll={() => handleSelectAll(column.key)}
                          onClearFilter={() => handleClearFilter(column.key)}
                          onSearchChange={(search) =>
                            handleSearchFilterChange(column.key, search)
                          }
                          onDateRangeChange={(rangePatch) =>
                            handleDateRangeFilterChange(column.key, rangePatch)
                          }
                          onSort={(direction) =>
                            handleSort(column.key, direction)
                          }
                          onClose={() => {
                            setActiveFilterKey(null);
                            setActiveFilterRect(null);
                          }}
                          anchorRect={activeFilterRect}
                        />
                      ) : null}
                    </th>
                  );
                })}
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {statusMessage ? (
                <tr>
                  <EmptyCell colSpan="8">{statusMessage}</EmptyCell>
                </tr>
              ) : (
                displayedPeople.map((person) => (
                  <tr
                    key={person.id}
                    data-selected={person.id === selectedPersonId}
                    onClick={() => setSelectedPersonId(person.id)}
                  >
                    <td>{person.name}</td>
                    <td>{getPersonWorkId(person)}</td>
                    <td><PersonTypeLabel value={person.type} /></td>
                    <td>{person.department ?? "--"}</td>
                    <td>
                      <StatusInline $tone={getStatusTone(person.status)}>
                        {getDisplayStatus(person.status)}
                      </StatusInline>
                    </td>
                    <td>{person.location_zone ?? "--"}</td>
                    <td>{formatTime(getPersonUpdateTime(person))}</td>
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
  padding: ${BUSINESS_PAGE_LAYOUT.padding};
  background: hsl(216 26% 97%);
`;

const PageHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
`;

const PageTitle = styled.h1`
  margin: 0;
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.peoplePageTitle};
  font-weight: 700;
  line-height: ${BUSINESS_PAGE_LAYOUT.titleLineHeight};
`;

const SearchInput = styled.input`
  width: min(360px, 44vw);
  height: 34px;
  border: 1px solid hsl(220 13% 84%);
  border-radius: 6px;
  padding: 0 12px;
  color: hsl(218 15% 24%);
  background: white;
  font-size: ${FONT_SIZES.peopleSearchInput};
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
  grid-template-columns: 56px minmax(0, 1fr);
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

const SelectedNameRow = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
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
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
`;

const PrimaryButton = styled.button`
  width: 100%;
  height: 36px;
  border: 0;
  border-radius: 6px;
  color: white;
  background: hsl(214 92% 56%);
  font-size: ${FONT_SIZES.peopleCardAction};
  font-weight: 700;
  cursor: pointer;

  &[data-active="false"] {
    color: hsl(214 92% 48%);
    border: 1px solid hsl(214 92% 56% / 0.32);
    background: white;
  }

  &:hover {
    background: hsl(214 92% 48%);
  }

  &[data-active="false"]:hover {
    color: white;
  }
`;

const SecondaryButton = styled.button`
  width: 100%;
  height: 36px;
  border: 1px solid hsl(220 13% 86%);
  border-radius: 6px;
  color: hsl(218 15% 24%);
  background: white;
  font-size: ${FONT_SIZES.peopleCardAction};
  font-weight: 700;
  cursor: pointer;

  &:hover {
    border-color: hsl(214 92% 56% / 0.42);
    color: hsl(214 92% 48%);
    background: hsl(214 92% 56% / 0.06);
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
    z-index: 2;
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

const HeaderFilterButton = styled.button`
  width: 100%;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  border: 0;
  padding: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  font-weight: 700;
  cursor: pointer;

  span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  span:last-child {
    color: hsl(214 92% 48%);
    font-size: ${FONT_SIZES.peopleDetailLabel};
  }

  &[data-active="true"] {
    color: hsl(214 92% 42%);
  }
`;

const FilterPopoverLayer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: transparent;
`;

const FilterPopover = styled.div`
  position: fixed;
  top: ${(p) => `${p.$top}px`};
  left: ${(p) => `min(${p.$left}px, calc(100vw - 248px))`};
  z-index: 1001;
  width: 236px;
  max-height: 200px;
  display: grid;
  grid-template-rows: auto;
  align-content: start;
  border: 1px solid hsl(220 13% 86%);
  border-radius: 8px;
  padding: 10px;
  background: white;
  box-shadow: 0 18px 40px hsl(220 20% 10% / 0.18);
  overflow: hidden;
`;

const FilterPopoverHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: hsl(218 15% 24%);
  font-size: ${FONT_SIZES.peopleTable};
`;

const CloseFilterButton = styled.button`
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 5px;
  color: hsl(218 10% 48%);
  background: transparent;
  font-size: ${FONT_SIZES.peopleCloseButton};
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: hsl(220 13% 94%);
  }
`;

const SortActions = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 8px;
`;

const SortButton = styled.button`
  height: 28px;
  border: 1px solid hsl(220 13% 86%);
  border-radius: 5px;
  color: hsl(218 15% 28%);
  background: white;
  font-size: ${FONT_SIZES.peopleDetailLabel};
  cursor: pointer;

  &[data-active="true"],
  &:hover {
    border-color: hsl(214 92% 56%);
    color: hsl(214 92% 46%);
    background: hsl(214 92% 56% / 0.08);
  }
`;

const FilterSearchInput = styled.input`
  width: 100%;
  height: 30px;
  box-sizing: border-box;
  border: 1px solid hsl(220 13% 84%);
  border-radius: 6px;
  margin-top: 8px;
  padding: 0 9px;
  color: hsl(218 15% 24%);
  background: white;
  font-size: ${FONT_SIZES.peopleDetailLabel};
  outline: none;

  &:focus {
    border-color: hsl(214 92% 56%);
    box-shadow: 0 0 0 3px hsl(214 92% 56% / 0.12);
  }
`;

const DateRangeFields = styled.div`
  display: grid;
  gap: 8px;
  margin-top: 8px;

  label {
    display: grid;
    gap: 4px;
    color: hsl(218 10% 46%);
    font-size: ${FONT_SIZES.peopleDetailLabel};
    font-weight: 600;
  }

  input {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    border: 1px solid hsl(220 13% 84%);
    border-radius: 6px;
    padding: 5px 7px;
    color: hsl(218 15% 24%);
    background: white;
    font: inherit;
    font-size: ${FONT_SIZES.peopleDetailLabel};
    outline: none;
  }

  input:focus {
    border-color: hsl(214 92% 56%);
    box-shadow: 0 0 0 3px hsl(214 92% 56% / 0.12);
  }
`;

const FilterToolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;

  button {
    border: 0;
    color: hsl(214 92% 48%);
    background: transparent;
    font-size: ${FONT_SIZES.peopleDetailLabel};
    cursor: pointer;
  }
`;

const FilterOptionList = styled.div`
  min-height: 0;
  overflow: auto;
  display: grid;
  gap: 6px;
  margin-top: 8px;
  padding-right: 2px;
  height: 80px;
  overflow: auto;
`;

const FilterOption = styled.label`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  color: hsl(218 15% 24%);
  font-size: ${FONT_SIZES.peopleTable};
  cursor: pointer;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  input {
    width: 14px;
    height: 14px;
    accent-color: hsl(214 92% 56%);
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
function PersonTypeLabel({ value }) {
  const dictionaries = useRuntimeDictionaries();
  return dictionaryLabel(dictionaries, "person_type", value, value);
}
