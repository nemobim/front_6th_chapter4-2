import { DndContext, Modifier, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { PropsWithChildren, useCallback } from "react";
import { CellSize, DAY_LABELS } from "./constants.ts";
import { useScheduleActions } from "./ScheduleContext.tsx";

// Modifier를 컴포넌트 외부로 이동하여 매번 생성되지 않도록 최적화
const snapModifier: Modifier = ({ transform, containerNodeRect, draggingNodeRect }) => {
  const containerTop = containerNodeRect?.top ?? 0;
  const containerLeft = containerNodeRect?.left ?? 0;
  const containerBottom = containerNodeRect?.bottom ?? 0;
  const containerRight = containerNodeRect?.right ?? 0;

  const { top = 0, left = 0, bottom = 0, right = 0 } = draggingNodeRect ?? {};

  const minX = containerLeft - left + 120 + 1;
  const minY = containerTop - top + 40 + 1;
  const maxX = containerRight - right;
  const maxY = containerBottom - bottom;

  return {
    ...transform,
    x: Math.min(Math.max(Math.round(transform.x / CellSize.WIDTH) * CellSize.WIDTH, minX), maxX),
    y: Math.min(Math.max(Math.round(transform.y / CellSize.HEIGHT) * CellSize.HEIGHT, minY), maxY),
  };
};

// 모든 정적 값들을 외부로 이동
const modifiers = [snapModifier];
const sensorConfig = { activationConstraint: { distance: 8 } };

export default function ScheduleDndProvider({ children }: PropsWithChildren) {
  const { setSchedulesMap } = useScheduleActions();

  // sensors는 참조가 변하지 않으므로 useMemo 불필요
  const sensors = useSensors(useSensor(PointerSensor, sensorConfig));

  // 범위 검증 로직을 별도 함수로 분리하여 가독성 향상
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isValidMove = useCallback((newDayIndex: number, schedule: any, moveTimeIndex: number) => {
    if (newDayIndex < 0 || newDayIndex >= DAY_LABELS.length) return false;

    // 시간 범위가 음수가 되지 않도록 검증
    const newTimeRange = schedule.range.map((time: number) => time + moveTimeIndex);
    return newTimeRange.every((time: number) => time > 0);
  }, []);

  const handleDragEnd = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      const { active, delta } = event;
      const { x, y } = delta;
      const [tableId, index] = active.id.split(":");

      setSchedulesMap((prev) => {
        const schedule = prev[tableId]?.[index];
        if (!schedule) return prev;

        const nowDayIndex = DAY_LABELS.indexOf(schedule.day as (typeof DAY_LABELS)[number]);
        const moveDayIndex = Math.floor(x / CellSize.WIDTH);
        const moveTimeIndex = Math.floor(y / CellSize.HEIGHT);
        const newDayIndex = nowDayIndex + moveDayIndex;

        // 유효성 검사를 별도 함수로 분리
        if (!isValidMove(newDayIndex, schedule, moveTimeIndex)) {
          return prev;
        }

        // 불변성을 유지하면서 업데이트
        return {
          ...prev,
          [tableId]: prev[tableId].map((targetSchedule, targetIndex) =>
            targetIndex === Number(index)
              ? {
                  ...targetSchedule,
                  day: DAY_LABELS[newDayIndex],
                  range: targetSchedule.range.map((time) => time + moveTimeIndex),
                }
              : targetSchedule
          ),
        };
      });
    },
    [setSchedulesMap, isValidMove] // isValidMove 의존성 추가
  );

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd} modifiers={modifiers}>
      {children}
    </DndContext>
  );
}
