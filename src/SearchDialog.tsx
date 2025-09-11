import {
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Table,
  Tag,
  TagCloseButton,
  TagLabel,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  Wrap,
} from "@chakra-ui/react";
import axios from "axios";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DAY_LABELS } from "./constants.ts";
import { useScheduleActions } from "./ScheduleContext.tsx";
import { Lecture } from "./types.ts";
import { cacheStore, parseSchedule } from "./utils.ts";
import { useDebounce } from "./hooks/useDebounce.ts";

interface Props {
  searchInfo: {
    tableId: string;
    day?: string;
    time?: number;
  } | null;
  onClose: () => void;
}

interface SearchOption {
  query: string;
  grades: number[];
  days: string[];
  times: number[];
  majors: string[];
  credits: string;
}

// 정적 데이터들을 컴포넌트 외부로 이동하여 매번 재생성 방지
const TIME_SLOTS = [
  { id: 1, label: "09:00~09:30" },
  { id: 2, label: "09:30~10:00" },
  { id: 3, label: "10:00~10:30" },
  { id: 4, label: "10:30~11:00" },
  { id: 5, label: "11:00~11:30" },
  { id: 6, label: "11:30~12:00" },
  { id: 7, label: "12:00~12:30" },
  { id: 8, label: "12:30~13:00" },
  { id: 9, label: "13:00~13:30" },
  { id: 10, label: "13:30~14:00" },
  { id: 11, label: "14:00~14:30" },
  { id: 12, label: "14:30~15:00" },
  { id: 13, label: "15:00~15:30" },
  { id: 14, label: "15:30~16:00" },
  { id: 15, label: "16:00~16:30" },
  { id: 16, label: "16:30~17:00" },
  { id: 17, label: "17:00~17:30" },
  { id: 18, label: "17:30~18:00" },
  { id: 19, label: "18:00~18:50" },
  { id: 20, label: "18:55~19:45" },
  { id: 21, label: "19:50~20:40" },
  { id: 22, label: "20:45~21:35" },
  { id: 23, label: "21:40~22:30" },
  { id: 24, label: "22:35~23:25" },
] as const;

const PAGE_SIZE = 100;
const GRADE_OPTIONS = [1, 2, 3, 4] as const;
const CREDIT_OPTIONS = [
  { value: "", label: "전체" },
  { value: "1", label: "1학점" },
  { value: "2", label: "2학점" },
  { value: "3", label: "3학점" },
] as const;

// 초기 검색 옵션
const INITIAL_SEARCH_OPTIONS: SearchOption = {
  query: "",
  grades: [],
  days: [],
  times: [],
  majors: [],
  credits: "",
};

// 캐시 및 API 최적화
const cache = cacheStore<Lecture[]>();

const fetchMajorsFn = () => axios.get<Lecture[]>("/schedules-majors.json").then((response) => response.data);
const fetchLiberalArtsFn = () => axios.get<Lecture[]>("/schedules-liberal-arts.json").then((response) => response.data);

const fetchMajors = () => cache.get("majors", fetchMajorsFn);
const fetchLiberalArts = () => cache.get("liberal-arts", fetchLiberalArtsFn);

// 성능 테스트용 중복 호출 - 캐싱 효과 확인
const fetchAllLectures = async () => {
  const promises = [
    fetchMajors(), // API Call 1
    fetchLiberalArts(), // API Call 2
    fetchMajors(), // API Call 3
    fetchLiberalArts(), // API Call 4
    fetchMajors(), // API Call 5
    fetchLiberalArts(), // API Call 6
  ];

  promises.forEach((_, index) => {
    console.log(`API Call ${index + 1}`, performance.now());
  });

  const results = await Promise.all(promises);
  console.log("모든 API 호출 완료", performance.now());

  return results.flatMap((result) => result);
};

// 스케줄 파싱 캐시 최적화
const scheduleParseCache = new Map<string, ReturnType<typeof parseSchedule>>();
const getParsedSchedule = (schedule: string) => {
  if (!schedule) return [];
  let cached = scheduleParseCache.get(schedule);
  if (!cached) {
    cached = parseSchedule(schedule);
    scheduleParseCache.set(schedule, cached);
  }
  return cached;
};

// 메모이제이션된 컴포넌트들
const LectureRow = memo(
  ({ lecture, onAddSchedule }: { lecture: Lecture; onAddSchedule: (lecture: Lecture) => void }) => {
    const handleAdd = useCallback(() => onAddSchedule(lecture), [onAddSchedule, lecture]);

    return (
      <Tr>
        <Td width="100px">{lecture.id}</Td>
        <Td width="50px">{lecture.grade}</Td>
        <Td width="200px">{lecture.title}</Td>
        <Td width="50px">{lecture.credits}</Td>
        <Td width="150px" dangerouslySetInnerHTML={{ __html: lecture.major }} />
        <Td width="150px" dangerouslySetInnerHTML={{ __html: lecture.schedule }} />
        <Td width="80px">
          <Button size="sm" colorScheme="green" onClick={handleAdd}>
            추가
          </Button>
        </Td>
      </Tr>
    );
  }
);

const SearchQueryFormControl = memo(
  ({ query, onChange }: { query: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <FormControl>
      <FormLabel>검색어</FormLabel>
      <Input placeholder="과목명 또는 과목코드" value={query} onChange={onChange} />
    </FormControl>
  )
);

const CreditsFormControl = memo(
  ({ credits, onChange }: { credits: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void }) => (
    <FormControl>
      <FormLabel>학점</FormLabel>
      <Select value={credits} onChange={onChange}>
        {CREDIT_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </FormControl>
  )
);

const GradesFormControl = memo(({ grades, onChange }: { grades: number[]; onChange: (value: string[]) => void }) => (
  <FormControl>
    <FormLabel>학년</FormLabel>
    <CheckboxGroup value={grades} onChange={onChange}>
      <HStack spacing={4}>
        {GRADE_OPTIONS.map((grade) => (
          <Checkbox key={grade} value={grade}>
            {grade}학년
          </Checkbox>
        ))}
      </HStack>
    </CheckboxGroup>
  </FormControl>
));

const DaysFormControl = memo(({ days, onChange }: { days: string[]; onChange: (value: string[]) => void }) => (
  <FormControl>
    <FormLabel>요일</FormLabel>
    <CheckboxGroup value={days} onChange={onChange}>
      <HStack spacing={4}>
        {DAY_LABELS.map((day) => (
          <Checkbox key={day} value={day}>
            {day}
          </Checkbox>
        ))}
      </HStack>
    </CheckboxGroup>
  </FormControl>
));

const TimesFormControl = memo(
  ({
    times,
    sortedSelectedTimes,
    onTimesChange,
    onTimeRemove,
  }: {
    times: number[];
    sortedSelectedTimes: number[];
    onTimesChange: (values: string[]) => void;
    onTimeRemove: (time: number) => void;
  }) => (
    <FormControl>
      <FormLabel>시간</FormLabel>
      <CheckboxGroup colorScheme="green" value={times} onChange={onTimesChange}>
        <Wrap spacing={1} mb={2}>
          {sortedSelectedTimes.map((time) => (
            <Tag key={time} size="sm" variant="outline" colorScheme="blue">
              <TagLabel>{time}교시</TagLabel>
              <TagCloseButton onClick={() => onTimeRemove(time)} />
            </Tag>
          ))}
        </Wrap>
        <Stack spacing={2} overflowY="auto" h="100px" border="1px solid" borderColor="gray.200" borderRadius={5} p={2}>
          {TIME_SLOTS.map(({ id, label }) => (
            <Box key={id}>
              <Checkbox size="sm" value={id}>
                {id}교시({label})
              </Checkbox>
            </Box>
          ))}
        </Stack>
      </CheckboxGroup>
    </FormControl>
  )
);

const MajorsFormControl = memo(
  ({
    majors,
    allMajors,
    onMajorsChange,
    onMajorRemove,
  }: {
    majors: string[];
    allMajors: string[];
    onMajorsChange: (values: string[]) => void;
    onMajorRemove: (major: string) => void;
  }) => (
    <FormControl>
      <FormLabel>전공</FormLabel>
      <CheckboxGroup colorScheme="green" value={majors} onChange={onMajorsChange}>
        <Wrap spacing={1} mb={2}>
          {majors.map((major) => (
            <Tag key={major} size="sm" variant="outline" colorScheme="blue">
              <TagLabel>{major.split("<p>").pop()}</TagLabel>
              <TagCloseButton onClick={() => onMajorRemove(major)} />
            </Tag>
          ))}
        </Wrap>
        <Stack spacing={2} overflowY="auto" h="100px" border="1px solid" borderColor="gray.200" borderRadius={5} p={2}>
          {allMajors.map((major) => (
            <Box key={major}>
              <Checkbox size="sm" value={major}>
                {major.replace(/<p>/gi, " ")}
              </Checkbox>
            </Box>
          ))}
        </Stack>
      </CheckboxGroup>
    </FormControl>
  )
);

// 메인 컴포넌트
const SearchDialog = ({ searchInfo, onClose }: Props) => {
  const { setSchedulesMap } = useScheduleActions();

  const loaderWrapperRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [page, setPage] = useState(1);
  const [searchOptions, setSearchOptions] = useState<SearchOption>(INITIAL_SEARCH_OPTIONS);

  // 디바운스 적용으로 검색 성능 최적화
  const debouncedQuery = useDebounce(searchOptions.query, 300);

  // 필터링 로직 최적화 - 스케줄 파싱은 한 번만 수행
  const filteredLectures = useMemo(() => {
    const { credits, grades, days, times, majors } = searchOptions;

    return lectures.filter((lecture) => {
      // 검색어 필터 (디바운스된 값 사용)
      if (debouncedQuery) {
        const queryLower = debouncedQuery.toLowerCase();
        if (!lecture.title.toLowerCase().includes(queryLower) && !lecture.id.toLowerCase().includes(queryLower)) {
          return false;
        }
      }

      // 학년 필터
      if (grades.length > 0 && !grades.includes(lecture.grade)) {
        return false;
      }

      // 전공 필터
      if (majors.length > 0 && !majors.includes(lecture.major)) {
        return false;
      }

      // 학점 필터
      if (credits && !lecture.credits.startsWith(credits)) {
        return false;
      }

      // 요일 및 시간 필터 - 스케줄 파싱 캐시 활용
      if (days.length > 0 || times.length > 0) {
        const schedules = getParsedSchedule(lecture.schedule);

        if (days.length > 0 && !schedules.some((s) => days.includes(s.day))) {
          return false;
        }

        if (times.length > 0 && !schedules.some((s) => s.range.some((time) => times.includes(time)))) {
          return false;
        }
      }

      return true;
    });
  }, [lectures, debouncedQuery, searchOptions]);

  // 페이지네이션 계산 최적화
  const lastPage = useMemo(() => Math.ceil(filteredLectures.length / PAGE_SIZE), [filteredLectures.length]);
  const visibleLectures = useMemo(() => filteredLectures.slice(0, page * PAGE_SIZE), [filteredLectures, page]);

  // 전공 목록 최적화
  const allMajors = useMemo(() => Array.from(new Set(lectures.map((lecture) => lecture.major))), [lectures]);

  // 정렬된 시간 목록 메모화
  const sortedSelectedTimes = useMemo(() => [...searchOptions.times].sort((a, b) => a - b), [searchOptions.times]);

  // 검색 옵션 변경 핸들러 최적화
  const changeSearchOption = useCallback(<K extends keyof SearchOption>(field: K, value: SearchOption[K]) => {
    setPage(1);
    setSearchOptions((prev) => ({ ...prev, [field]: value }));
    loaderWrapperRef.current?.scrollTo(0, 0);
  }, []);

  // 각 필터 변경 핸들러들
  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      changeSearchOption("query", e.target.value);
    },
    [changeSearchOption]
  );

  const handleCreditsChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      changeSearchOption("credits", e.target.value);
    },
    [changeSearchOption]
  );

  const handleGradesChange = useCallback(
    (value: string[]) => {
      changeSearchOption("grades", value.map(Number));
    },
    [changeSearchOption]
  );

  const handleDaysChange = useCallback(
    (value: string[]) => {
      changeSearchOption("days", value);
    },
    [changeSearchOption]
  );

  const handleTimesChange = useCallback(
    (values: string[]) => {
      changeSearchOption("times", values.map(Number));
    },
    [changeSearchOption]
  );

  const handleMajorsChange = useCallback(
    (values: string[]) => {
      changeSearchOption("majors", values);
    },
    [changeSearchOption]
  );

  const handleTimeRemove = useCallback(
    (time: number) => {
      changeSearchOption(
        "times",
        searchOptions.times.filter((v) => v !== time)
      );
    },
    [changeSearchOption, searchOptions.times]
  );

  const handleMajorRemove = useCallback(
    (major: string) => {
      changeSearchOption(
        "majors",
        searchOptions.majors.filter((v) => v !== major)
      );
    },
    [changeSearchOption, searchOptions.majors]
  );

  // 스케줄 추가 핸들러
  const addSchedule = useCallback(
    (lecture: Lecture) => {
      if (!searchInfo) return;

      const { tableId } = searchInfo;
      const schedules = getParsedSchedule(lecture.schedule).map((schedule) => ({
        ...schedule,
        lecture,
      }));

      setSchedulesMap((prev) => ({
        ...prev,
        [tableId]: [...prev[tableId], ...schedules],
      }));

      onClose();
    },
    [searchInfo, setSchedulesMap, onClose]
  );

  // API 호출 effect 최적화
  useEffect(() => {
    if (!searchInfo || lectures.length > 0) {
      if (lectures.length > 0) {
        console.log("이미 로드된 데이터 사용, API 호출 생략");
      }
      return;
    }

    const loadData = async () => {
      const start = performance.now();
      console.log("API 호출 시작: ", start);

      try {
        const results = await fetchAllLectures();
        const end = performance.now();
        console.log("API 호출에 걸린 시간(ms): ", end - start);
        setLectures(results);
      } catch (error) {
        console.error("API 호출 실패:", error);
      }
    };

    loadData();
  }, [searchInfo, lectures.length]);

  // Intersection Observer effect
  useEffect(() => {
    const $loader = loaderRef.current;
    const $loaderWrapper = loaderWrapperRef.current;

    if (!$loader || !$loaderWrapper) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && page < lastPage) {
          setPage((prevPage) => prevPage + 1);
        }
      },
      { threshold: 0, root: $loaderWrapper }
    );

    observer.observe($loader);
    return () => observer.unobserve($loader);
  }, [lastPage, page]);

  // 검색 정보 초기화 effect
  useEffect(() => {
    if (!searchInfo) return;

    setSearchOptions({
      ...INITIAL_SEARCH_OPTIONS,
      days: searchInfo.day ? [searchInfo.day] : [],
      times: searchInfo.time ? [searchInfo.time] : [],
    });
    setPage(1);
  }, [searchInfo]);

  return (
    <Modal isOpen={Boolean(searchInfo)} onClose={onClose} size="6xl">
      <ModalOverlay />
      <ModalContent maxW="90vw" w="1000px">
        <ModalHeader>수업 검색</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <HStack spacing={4}>
              <SearchQueryFormControl query={searchOptions.query} onChange={handleQueryChange} />
              <CreditsFormControl credits={searchOptions.credits} onChange={handleCreditsChange} />
            </HStack>

            <HStack spacing={4}>
              <GradesFormControl grades={searchOptions.grades} onChange={handleGradesChange} />
              <DaysFormControl days={searchOptions.days} onChange={handleDaysChange} />
            </HStack>

            <HStack spacing={4}>
              <TimesFormControl
                times={searchOptions.times}
                sortedSelectedTimes={sortedSelectedTimes}
                onTimesChange={handleTimesChange}
                onTimeRemove={handleTimeRemove}
              />
              <MajorsFormControl
                majors={searchOptions.majors}
                allMajors={allMajors}
                onMajorsChange={handleMajorsChange}
                onMajorRemove={handleMajorRemove}
              />
            </HStack>

            <Text align="right">검색결과: {filteredLectures.length}개</Text>

            <Box>
              <Table>
                <Thead>
                  <Tr>
                    <Th width="100px">과목코드</Th>
                    <Th width="50px">학년</Th>
                    <Th width="200px">과목명</Th>
                    <Th width="50px">학점</Th>
                    <Th width="150px">전공</Th>
                    <Th width="150px">시간</Th>
                    <Th width="80px"></Th>
                  </Tr>
                </Thead>
              </Table>

              <Box overflowY="auto" maxH="500px" ref={loaderWrapperRef}>
                <Table size="sm" variant="striped">
                  <Tbody>
                    {visibleLectures.map((lecture, index) => (
                      <LectureRow key={`${lecture.id}-${index}`} lecture={lecture} onAddSchedule={addSchedule} />
                    ))}
                  </Tbody>
                </Table>
                <Box ref={loaderRef} h="20px" />
              </Box>
            </Box>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

// displayName 설정
LectureRow.displayName = "LectureRow";
SearchQueryFormControl.displayName = "SearchQueryFormControl";
CreditsFormControl.displayName = "CreditsFormControl";
GradesFormControl.displayName = "GradesFormControl";
DaysFormControl.displayName = "DaysFormControl";
TimesFormControl.displayName = "TimesFormControl";
MajorsFormControl.displayName = "MajorsFormControl";

export default SearchDialog;
