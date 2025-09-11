import {
  Box,
  Button,
  Grid,
  GridItem,
  Flex,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverTrigger,
  Text,
} from "@chakra-ui/react";
import { CellSize, DAY_LABELS, 분 } from "./constants.ts";
import { Schedule } from "./types.ts";
import { fill2, parseHnM } from "./utils.ts";
import { useDndContext, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ComponentProps, Fragment, memo, useMemo, useCallback } from "react";

type TimeInfo = { day: string; time: number };

interface Props {
  tableId: string;
  schedules: Schedule[];
  onScheduleTimeClick?: (timeInfo: TimeInfo) => void;
  onDeleteButtonClick?: (timeInfo: TimeInfo) => void;
}

// 정적 데이터를 컴포넌트 외부로 이동하여 매번 재생성되지 않도록 최적화
const TIMES = [
  ...Array(18)
    .fill(0)
    .map((v, k) => v + k * 30 * 분)
    .map((v) => `${parseHnM(v)}~${parseHnM(v + 30 * 분)}`),
  ...Array(6)
    .fill(18 * 30 * 분)
    .map((v, k) => v + k * 55 * 분)
    .map((v) => `${parseHnM(v)}~${parseHnM(v + 50 * 분)}`),
] as const;

// 색상 배열을 상수로 분리
const LECTURE_COLORS = ["#fdd", "#ffd", "#dff", "#ddf", "#fdf", "#dfd"] as const;

const ScheduleTable = memo(({ tableId, schedules, onScheduleTimeClick, onDeleteButtonClick }: Props) => {
  const dndContext = useDndContext();

  // 색상 매핑 최적화 - Map 사용으로 O(1) 조회
  const getColor = useMemo(() => {
    const uniqueIds = [...new Set(schedules.map(({ lecture }) => lecture.id))];
    const lectureColor = new Map<string, string>();

    uniqueIds.forEach((id, idx) => {
      lectureColor.set(id, LECTURE_COLORS[idx % LECTURE_COLORS.length]);
    });

    return (lectureId: string): string => lectureColor.get(lectureId) ?? LECTURE_COLORS[0];
  }, [schedules]);

  // 활성 테이블 상태 계산 최적화
  const isActive = useMemo(() => {
    const activeId = dndContext.active?.id;
    return activeId ? String(activeId).split(":")[0] === tableId : false;
  }, [dndContext.active?.id, tableId]);

  // 이벤트 핸들러 메모이제이션으로 자식 컴포넌트 불필요한 리렌더링 방지
  const handleScheduleTimeClick = useCallback(
    (timeInfo: TimeInfo) => {
      onScheduleTimeClick?.(timeInfo);
    },
    [onScheduleTimeClick]
  );

  const handleDeleteButtonClick = useCallback(
    (schedule: Schedule) => {
      onDeleteButtonClick?.({ day: schedule.day, time: schedule.range[0] });
    },
    [onDeleteButtonClick]
  );

  return (
    <Box position="relative" outline={isActive ? "5px dashed" : undefined} outlineColor="blue.300">
      <TableGrid onScheduleTimeClick={handleScheduleTimeClick} />

      {schedules.map((schedule, index) => (
        <DraggableSchedule
          key={`${schedule.lecture.id}-${index}`} // title 대신 id 사용으로 안정성 향상
          id={`${tableId}:${index}`}
          data={schedule}
          bg={getColor(schedule.lecture.id)}
          onDeleteButtonClick={() => handleDeleteButtonClick(schedule)}
        />
      ))}
    </Box>
  );
});

// 테이블 그리드 컴포넌트 - memo로 불필요한 리렌더링 방지
const TableGrid = memo(({ onScheduleTimeClick }: { onScheduleTimeClick?: (timeInfo: TimeInfo) => void }) => {
  // 셀 클릭 핸들러 메모이제이션
  const handleCellClick = useCallback(
    (day: string, timeIndex: number) => {
      onScheduleTimeClick?.({ day, time: timeIndex + 1 });
    },
    [onScheduleTimeClick]
  );

  // 그리드 템플릿 계산을 useMemo로 최적화
  const gridTemplate = useMemo(
    () => ({
      columns: `120px repeat(${DAY_LABELS.length}, ${CellSize.WIDTH}px)`,
      rows: `40px repeat(${TIMES.length}, ${CellSize.HEIGHT}px)`,
    }),
    []
  );

  return (
    <Grid
      templateColumns={gridTemplate.columns}
      templateRows={gridTemplate.rows}
      bg="white"
      fontSize="sm"
      textAlign="center"
      outline="1px solid"
      outlineColor="gray.300"
    >
      {/* 헤더 셀 - 교시 */}
      <GridItem borderColor="gray.300" bg="gray.100">
        <Flex justifyContent="center" alignItems="center" h="full" w="full">
          <Text fontWeight="bold">교시</Text>
        </Flex>
      </GridItem>

      {/* 요일 헤더 */}
      {DAY_LABELS.map((day) => (
        <GridItem key={day} borderLeft="1px" borderColor="gray.300" bg="gray.100">
          <Flex justifyContent="center" alignItems="center" h="full">
            <Text fontWeight="bold">{day}</Text>
          </Flex>
        </GridItem>
      ))}

      {/* 시간표 그리드 */}
      {TIMES.map((time, timeIndex) => {
        const isEveningTime = timeIndex > 17; // 야간 시간대 여부

        return (
          <Fragment key={timeIndex}>
            {/* 시간 라벨 셀 */}
            <GridItem borderTop="1px solid" borderColor="gray.300" bg={isEveningTime ? "gray.200" : "gray.100"}>
              <Flex justifyContent="center" alignItems="center" h="full">
                <Text fontSize="xs">
                  {fill2(timeIndex + 1)} ({time})
                </Text>
              </Flex>
            </GridItem>

            {/* 각 요일별 시간 셀 */}
            {DAY_LABELS.map((day) => (
              <GridItem
                key={`${day}-${timeIndex}`}
                borderWidth="1px 0 0 1px"
                borderColor="gray.300"
                bg={isEveningTime ? "gray.100" : "white"}
                cursor="pointer"
                _hover={{ bg: "yellow.100" }}
                onClick={() => handleCellClick(day, timeIndex)}
              />
            ))}
          </Fragment>
        );
      })}
    </Grid>
  );
});

// 드래그 가능한 스케줄 컴포넌트
const DraggableSchedule = memo(
  ({
    id,
    data,
    bg,
    onDeleteButtonClick,
  }: {
    id: string;
    data: Schedule;
    onDeleteButtonClick: () => void;
  } & ComponentProps<typeof Box>) => {
    const { day, range, room, lecture } = data;
    const { attributes, setNodeRef, listeners, transform } = useDraggable({ id });

    // 위치 및 크기 계산 최적화 - 의존성 배열을 구체적으로 명시
    const position = useMemo(() => {
      const leftIndex = DAY_LABELS.indexOf(day as (typeof DAY_LABELS)[number]);
      const topIndex = range[0] - 1;
      const size = range.length;

      return {
        left: `${120 + CellSize.WIDTH * leftIndex + 1}px`,
        top: `${40 + (topIndex * CellSize.HEIGHT + 1)}px`,
        width: `${CellSize.WIDTH - 1}px`,
        height: `${CellSize.HEIGHT * size - 1}px`,
      };
    }, [day, range]); // range 전체가 아닌 필요한 값만 의존성으로 설정

    // 이벤트 전파 방지 핸들러
    const handlePopoverClick = useCallback((event: React.MouseEvent) => {
      event.stopPropagation();
    }, []);

    return (
      <Popover isLazy>
        <PopoverTrigger>
          <Box
            position="absolute"
            {...position}
            bg={bg}
            p={1}
            boxSizing="border-box"
            cursor="pointer"
            ref={setNodeRef}
            transform={CSS.Translate.toString(transform)}
            {...listeners}
            {...attributes}
          >
            <Text fontSize="sm" fontWeight="bold" noOfLines={1}>
              {lecture.title}
            </Text>
            <Text fontSize="xs" noOfLines={1}>
              {room}
            </Text>
          </Box>
        </PopoverTrigger>
        <PopoverContent onClick={handlePopoverClick}>
          <PopoverArrow />
          <PopoverCloseButton />
          <PopoverBody>
            <Text mb={2}>강의를 삭제하시겠습니까?</Text>
            <Button colorScheme="red" size="xs" onClick={onDeleteButtonClick}>
              삭제
            </Button>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    );
  }
);

// 개발 도구에서 컴포넌트 식별을 위한 displayName 설정
ScheduleTable.displayName = "ScheduleTable";
TableGrid.displayName = "TableGrid";
DraggableSchedule.displayName = "DraggableSchedule";

export default ScheduleTable;
