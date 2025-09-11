import React, { createContext, PropsWithChildren, useContext, useMemo, useState, useCallback } from "react";
import { Schedule } from "./types.ts";
import dummyScheduleMap from "./dummyScheduleMap.ts";

type SchedulesMap = Record<string, Schedule[]>;

// 상태와 액션을 분리하여 불필요한 리렌더링 방지
interface ScheduleStateContextType {
  schedulesMap: SchedulesMap;
}

interface ScheduleActionsContextType {
  setSchedulesMap: React.Dispatch<React.SetStateAction<SchedulesMap>>;
  duplicate: (tableId: string) => void;
  remove: (tableId: string) => void;
  updateTable: (tableId: string, updater: (prev: Schedule[]) => Schedule[]) => void;
}

const ScheduleStateContext = createContext<ScheduleStateContextType | undefined>(undefined);
const ScheduleActionsContext = createContext<ScheduleActionsContextType | undefined>(undefined);

export const useScheduleState = () => {
  const context = useContext(ScheduleStateContext);
  if (context === undefined) {
    throw new Error("useScheduleState must be used within a ScheduleProvider");
  }
  return context;
};

export const useScheduleActions = () => {
  const context = useContext(ScheduleActionsContext);
  if (context === undefined) {
    throw new Error("useScheduleActions must be used within a ScheduleProvider");
  }
  return context;
};

export const ScheduleProvider = ({ children }: PropsWithChildren) => {
  const [schedulesMap, setSchedulesMap] = useState<SchedulesMap>(dummyScheduleMap);

  // useCallback으로 함수 메모이제이션하여 불필요한 리렌더링 방지
  const duplicate = useCallback((tableId: string) => {
    setSchedulesMap((prev) => ({
      ...prev,
      ["schedule-" + Date.now()]: [...(prev[tableId] ?? [])],
    }));
  }, []);

  const remove = useCallback((tableId: string) => {
    setSchedulesMap((prev) => {
      const copy = { ...prev } as SchedulesMap;
      delete copy[tableId];
      return copy;
    });
  }, []);

  const updateTable = useCallback((tableId: string, updater: (prev: Schedule[]) => Schedule[]) => {
    setSchedulesMap((prev) => ({
      ...prev,
      [tableId]: updater(prev[tableId] ?? []),
    }));
  }, []);

  // 상태값 메모이제이션 - schedulesMap이 변경될 때만 새 객체 생성
  const stateValue = useMemo<ScheduleStateContextType>(() => ({ schedulesMap }), [schedulesMap]);

  // 액션값 메모이제이션 - 함수들이 변경될 때만 새 객체 생성
  const actionsValue = useMemo<ScheduleActionsContextType>(
    () => ({ setSchedulesMap, duplicate, remove, updateTable }),
    [duplicate, remove, updateTable]
  );

  return (
    <ScheduleStateContext.Provider value={stateValue}>
      <ScheduleActionsContext.Provider value={actionsValue}>{children}</ScheduleActionsContext.Provider>
    </ScheduleStateContext.Provider>
  );
};
