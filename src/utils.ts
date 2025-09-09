export const fill2 = (n: number) => `0${n}`.substr(-2);

export const parseHnM = (current: number) => {
  const date = new Date(current);
  return `${fill2(date.getHours())}:${fill2(date.getMinutes())}`;
};

const getTimeRange = (value: string): number[] => {
  const [start, end] = value.split("~").map(Number);
  if (end === undefined) return [start];
  return Array(end - start + 1)
    .fill(start)
    .map((v, k) => v + k);
};

export const parseSchedule = (schedule: string) => {
  const schedules = schedule.split("<p>");
  return schedules.map((schedule) => {
    const reg = /^([가-힣])(\d+(~\d+)?)(.*)/;

    const [day] = schedule.split(/(\d+)/);

    const range = getTimeRange(schedule.replace(reg, "$2"));

    const room = schedule.replace(reg, "$4")?.replace(/\(|\)/g, "");

    return { day, range, room };
  });
};

// 클로저를 이용한 캐싱 처리
export const cacheStore = <T>() => {
  const cache = new Map<string, Promise<T>>();

  return {
    get: (key: string, fetcher: () => Promise<T>) => {
      if (cache.has(key)) {
        return cache.get(key)!;
      }
      const promise = fetcher();
      cache.set(key, promise);
      return promise;
    },
    has: (key: string) => cache.has(key),
    clear: () => cache.clear(),
    delete: (key: string) => cache.delete(key),
  };
};
