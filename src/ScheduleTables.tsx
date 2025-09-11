import { Button, ButtonGroup, Flex, Heading, Stack } from "@chakra-ui/react";
import { useDndContext } from "@dnd-kit/core";
import { memo, useCallback, useMemo, useState } from "react";
import ScheduleTable from "./ScheduleTable.tsx";
import { useScheduleActions, useScheduleState } from "./ScheduleContext.tsx";
import SearchDialog from "./SearchDialog.tsx";
import ScheduleDndProvider from "./ScheduleDndProvider.tsx";
import { Schedule } from "./types.ts";

// 검색 정보 타입 정의
type SearchInfo = {
  tableId: string;
  day?: string;
  time?: number;
} | null;

export const ScheduleTables = () => {
  const { schedulesMap } = useScheduleState();
  const dndContext = useDndContext();
  const [searchInfo, setSearchInfo] = useState<SearchInfo>(null);

  // 활성 테이블 ID 계산 최적화 - useMemo로 메모이제이션
  const activeTableId = useMemo(() => {
    const activeId = dndContext.active?.id;
    return activeId ? String(activeId).split(":")[0] : null;
  }, [dndContext.active?.id]);

  // 삭제 버튼 비활성화 상태 최적화
  const disabledRemoveButton = useMemo(() => Object.keys(schedulesMap).length === 1, [schedulesMap]);

  // 검색 열기 함수 최적화 - useCallback으로 메모이제이션
  const openSearch = useCallback((tableId: string, day?: string, time?: number) => {
    setSearchInfo({ tableId, day, time });
  }, []);

  // 검색 다이얼로그 닫기 함수 최적화
  const closeSearch = useCallback(() => setSearchInfo(null), []);

  // 테이블 엔트리들을 useMemo로 메모이제이션
  const tableEntries = useMemo(() => Object.entries(schedulesMap), [schedulesMap]);

  return (
    <>
      <Flex w="full" gap={6} p={6} flexWrap="wrap">
        {tableEntries.map(([tableId, schedules], index) => (
          <ScheduleCard
            key={tableId}
            index={index}
            tableId={tableId}
            schedules={schedules}
            disabledRemoveButton={disabledRemoveButton}
            openSearch={openSearch}
            isActive={activeTableId === tableId}
          />
        ))}
      </Flex>
      <SearchDialog searchInfo={searchInfo} onClose={closeSearch} />
    </>
  );
};

interface ScheduleCardProps {
  index: number;
  tableId: string;
  schedules: Schedule[];
  disabledRemoveButton: boolean;
  openSearch: (tableId: string, day?: string, time?: number) => void;
  isActive: boolean;
}

const ScheduleCard = memo(
  ({ index, tableId, schedules, disabledRemoveButton, openSearch, isActive }: ScheduleCardProps) => {
    const { duplicate, remove, updateTable } = useScheduleActions();

    // 시간표 셀 클릭 핸들러 - tableId 변경 시에만 재생성
    const onScheduleTimeClick = useCallback(
      (timeInfo: { day: string; time: number }) => openSearch(tableId, timeInfo.day, timeInfo.time),
      [openSearch, tableId]
    );

    // 스케줄 삭제 핸들러 - 함수형 업데이트로 최적화
    const onDeleteButtonClick = useCallback(
      ({ day, time }: { day: string; time: number }) =>
        updateTable(tableId, (prev) =>
          prev.filter((schedule) => schedule.day !== day || !schedule.range.includes(time))
        ),
      [updateTable, tableId]
    );

    // 버튼 클릭 핸들러들 최적화
    const handleAddSchedule = useCallback(() => openSearch(tableId), [openSearch, tableId]);
    const handleDuplicate = useCallback(() => duplicate(tableId), [duplicate, tableId]);
    const handleRemove = useCallback(() => remove(tableId), [remove, tableId]);

    // 헤더 제목 메모이제이션
    const headerTitle = useMemo(() => `시간표 ${index + 1}`, [index]);

    return (
      <Stack width="600px">
        <Flex
          justifyContent="space-between"
          alignItems="center"
          outline={isActive ? "5px dashed" : undefined}
          outlineColor="blue.300"
        >
          <Heading as="h3" fontSize="lg">
            {headerTitle}
          </Heading>
          <ButtonGroup size="sm" isAttached>
            <Button colorScheme="green" onClick={handleAddSchedule}>
              시간표 추가
            </Button>
            <Button colorScheme="green" mx="1px" onClick={handleDuplicate}>
              복제
            </Button>
            <Button colorScheme="green" isDisabled={disabledRemoveButton} onClick={handleRemove}>
              삭제
            </Button>
          </ButtonGroup>
        </Flex>
        <ScheduleDndProvider>
          <ScheduleTable
            schedules={schedules}
            tableId={tableId}
            onScheduleTimeClick={onScheduleTimeClick}
            onDeleteButtonClick={onDeleteButtonClick}
          />
        </ScheduleDndProvider>
      </Stack>
    );
  }
);

// memo 컴포넌트의 displayName 설정
ScheduleCard.displayName = "ScheduleCard";

export default ScheduleTables;
