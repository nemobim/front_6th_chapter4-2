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
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { DAY_LABELS } from "./constants.ts";
import { useScheduleContext } from "./ScheduleContext.tsx";
import { Lecture } from "./types.ts";
import { cacheStore, parseSchedule } from "./utils.ts";
import { useAutoCallback } from "./hooks/useAutoCallback.ts";
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
  query?: string;
  grades: number[];
  days: string[];
  times: number[];
  majors: string[];
  credits?: number;
}

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
];

const PAGE_SIZE = 100;

const cache = cacheStore<Lecture[]>();

// 데이터 가져오기
const fetchMajorsFn = () => axios.get<Lecture[]>("/schedules-majors.json").then((response) => response.data);
const fetchLiberalArtsFn = () => axios.get<Lecture[]>("/schedules-liberal-arts.json").then((response) => response.data);

// 함수 캐싱
const fetchMajors = () => cache.get("majors", fetchMajorsFn);
const fetchLiberalArts = () => cache.get("liberal-arts", fetchLiberalArtsFn);

// TODO: 이 코드를 개선해서 API 호출을 최소화 해보세요 + Promise.all이 현재 잘못 사용되고 있습니다. 같이 개선해주세요.
const fetchAllLectures = async () => {
  // Promise 배열을 먼저 생성하여 병렬 실행 보장
  const promises = [
    fetchMajors(), // API Call 1
    fetchLiberalArts(), // API Call 2
    fetchMajors(), // API Call 3
    fetchLiberalArts(), // API Call 4
    fetchMajors(), // API Call 5
    fetchLiberalArts(), // API Call 6
  ];

  // 각 Promise 시작 시점 로깅
  promises.forEach((_, index) => {
    console.log(`API Call ${index + 1}`, performance.now());
  });

  const results = await Promise.all(promises);
  console.log("모든 API 호출 완료", performance.now());

  return results.flatMap((result) => result);
};

const LectureRow = memo(
  ({ lecture, onAddSchedule }: { lecture: Lecture; onAddSchedule: (lecture: Lecture) => void }) => (
    <Tr>
      <Td width="100px">{lecture.id}</Td>
      <Td width="50px">{lecture.grade}</Td>
      <Td width="200px">{lecture.title}</Td>
      <Td width="50px">{lecture.credits}</Td>
      <Td width="150px" dangerouslySetInnerHTML={{ __html: lecture.major }} />
      <Td width="150px" dangerouslySetInnerHTML={{ __html: lecture.schedule }} />
      <Td width="80px">
        <Button size="sm" colorScheme="green" onClick={() => onAddSchedule(lecture)}>
          추가
        </Button>
      </Td>
    </Tr>
  )
);

LectureRow.displayName = "LectureRow";

const MajorCheckbox = memo(({ major, isSelected }: { major: string; isSelected: boolean }) => (
  <Box key={major}>
    <Checkbox key={major} size="sm" value={major} isChecked={isSelected}>
      {major.replace(/<p>/gi, " ")}
    </Checkbox>
  </Box>
));

MajorCheckbox.displayName = "MajorCheckbox";

// 시간대 체크박스
const TimeSlotCheckbox = memo(
  ({ timeSlot, isSelected }: { timeSlot: { id: number; label: string }; isSelected: boolean }) => (
    <Box key={timeSlot.id}>
      <Checkbox key={timeSlot.id} size="sm" value={timeSlot.id} isChecked={isSelected}>
        {timeSlot.id}교시({timeSlot.label})
      </Checkbox>
    </Box>
  )
);

TimeSlotCheckbox.displayName = "TimeSlotCheckbox";

// 선택된 시간 태그
const SelectedTimeTag = memo(({ time, onRemove }: { time: number; onRemove: (time: number) => void }) => (
  <Tag key={time} size="sm" variant="outline" colorScheme="blue">
    <TagLabel>{time}교시</TagLabel>
    <TagCloseButton onClick={() => onRemove(time)} />
  </Tag>
));

SelectedTimeTag.displayName = "SelectedTimeTag";

// 선택된 전공 태그
const SelectedMajorTag = memo(({ major, onRemove }: { major: string; onRemove: (major: string) => void }) => (
  <Tag key={major} size="sm" variant="outline" colorScheme="blue">
    <TagLabel>{major.split("<p>").pop()}</TagLabel>
    <TagCloseButton onClick={() => onRemove(major)} />
  </Tag>
));

SelectedMajorTag.displayName = "SelectedMajorTag";

// 학년 체크박스
const GradeCheckbox = memo(({ grade, isSelected }: { grade: number; isSelected: boolean }) => (
  <Checkbox key={grade} value={grade} isChecked={isSelected}>
    {grade}학년
  </Checkbox>
));

GradeCheckbox.displayName = "GradeCheckbox";

// 요일 체크박스
const DayCheckbox = memo(({ day, isSelected }: { day: string; isSelected: boolean }) => (
  <Checkbox key={day} value={day} isChecked={isSelected}>
    {day}
  </Checkbox>
));

DayCheckbox.displayName = "DayCheckbox";

// 검색어 FormControl
const SearchQueryFormControl = memo(
  ({ query, onChange }: { query: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <FormControl>
      <FormLabel>검색어</FormLabel>
      <Input placeholder="과목명 또는 과목코드" value={query} onChange={onChange} />
    </FormControl>
  )
);

SearchQueryFormControl.displayName = "SearchQueryFormControl";

// 학점 FormControl
const CreditsFormControl = memo(
  ({
    credits,
    onChange,
  }: {
    credits: number | undefined;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  }) => (
    <FormControl>
      <FormLabel>학점</FormLabel>
      <Select value={credits} onChange={onChange}>
        <option value="">전체</option>
        <option value="1">1학점</option>
        <option value="2">2학점</option>
        <option value="3">3학점</option>
      </Select>
    </FormControl>
  )
);

CreditsFormControl.displayName = "CreditsFormControl";

// 학년 FormControl
const GradesFormControl = memo(({ grades, onChange }: { grades: number[]; onChange: (value: string[]) => void }) => (
  <FormControl>
    <FormLabel>학년</FormLabel>
    <CheckboxGroup value={grades} onChange={onChange}>
      <HStack spacing={4}>
        {[1, 2, 3, 4].map((grade) => (
          <GradeCheckbox key={grade} grade={grade} isSelected={grades.includes(grade)} />
        ))}
      </HStack>
    </CheckboxGroup>
  </FormControl>
));

GradesFormControl.displayName = "GradesFormControl";

// 요일 FormControl
const DaysFormControl = memo(({ days, onChange }: { days: string[]; onChange: (value: string[]) => void }) => (
  <FormControl>
    <FormLabel>요일</FormLabel>
    <CheckboxGroup value={days} onChange={onChange}>
      <HStack spacing={4}>
        {DAY_LABELS.map((day) => (
          <DayCheckbox key={day} day={day} isSelected={days.includes(day)} />
        ))}
      </HStack>
    </CheckboxGroup>
  </FormControl>
));

DaysFormControl.displayName = "DaysFormControl";

// 시간 FormControl
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
            <SelectedTimeTag key={time} time={time} onRemove={onTimeRemove} />
          ))}
        </Wrap>
        <Stack spacing={2} overflowY="auto" h="100px" border="1px solid" borderColor="gray.200" borderRadius={5} p={2}>
          {TIME_SLOTS.map((timeSlot) => (
            <TimeSlotCheckbox key={timeSlot.id} timeSlot={timeSlot} isSelected={times.includes(timeSlot.id)} />
          ))}
        </Stack>
      </CheckboxGroup>
    </FormControl>
  )
);

TimesFormControl.displayName = "TimesFormControl";

// 전공 FormControl
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
            <SelectedMajorTag key={major} major={major} onRemove={onMajorRemove} />
          ))}
        </Wrap>
        <Stack spacing={2} overflowY="auto" h="100px" border="1px solid" borderColor="gray.200" borderRadius={5} p={2}>
          {allMajors.map((major) => (
            <MajorCheckbox key={major} major={major} isSelected={majors.includes(major)} />
          ))}
        </Stack>
      </CheckboxGroup>
    </FormControl>
  )
);

MajorsFormControl.displayName = "MajorsFormControl";

// TODO: 이 컴포넌트에서 불필요한 연산이 발생하지 않도록 다양한 방식으로 시도해주세요.
const SearchDialog = ({ searchInfo, onClose }: Props) => {
  const { setSchedulesMap } = useScheduleContext();

  const loaderWrapperRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [page, setPage] = useState(1);
  const [searchOptions, setSearchOptions] = useState<SearchOption>({
    query: "",
    grades: [],
    days: [],
    times: [],
    majors: [],
  });

  // 디바운스 적용
  const debouncedQuery = useDebounce(searchOptions.query, 300);

  // 불필요한 연산 방지 - 필터링 결과를 캐시하여 인피니트 스크롤시 재검색 방지
  const filteredLectures = useMemo(() => {
    const { credits, grades, days, times, majors } = searchOptions;

    return lectures.filter((lecture) => {
      // 검색어 필터링
      if (debouncedQuery) {
        const queryLower = debouncedQuery.toLowerCase();
        if (!lecture.title.toLowerCase().includes(queryLower) && !lecture.id.toLowerCase().includes(queryLower)) {
          return false;
        }
      }
      // 학년 필터링
      if (grades.length > 0 && !grades.includes(lecture.grade)) {
        return false;
      }

      // 전공 필터링
      if (majors.length > 0 && !majors.includes(lecture.major)) {
        return false;
      }

      // 학점 필터링
      if (credits && !lecture.credits.startsWith(String(credits))) {
        return false;
      }

      // 요일 필터링
      if (days.length > 0) {
        const schedules = lecture.schedule ? parseSchedule(lecture.schedule) : [];
        if (!schedules.some((s) => days.includes(s.day))) {
          return false;
        }
      }

      // 시간 필터링
      if (times.length > 0) {
        const schedules = lecture.schedule ? parseSchedule(lecture.schedule) : [];
        if (!schedules.some((s) => s.range.some((time) => times.includes(time)))) {
          return false;
        }
      }

      return true;
    });
  }, [lectures, debouncedQuery, searchOptions]);

  const lastPage = useMemo(() => Math.ceil(filteredLectures.length / PAGE_SIZE), [filteredLectures.length]);

  // 인피니트 스크롤용 - 이미 필터링된 결과를 슬라이싱만 (검색 재실행 X)
  const visibleLectures = useMemo(() => {
    return filteredLectures.slice(0, page * PAGE_SIZE);
  }, [filteredLectures, page]);

  const allMajors = useMemo(() => [...new Set(lectures.map((lecture) => lecture.major))], [lectures]);

  // 정렬된 시간 목록 메모화
  const sortedSelectedTimes = useMemo(() => searchOptions.times.sort((a, b) => a - b), [searchOptions.times]);

  const changeSearchOption = useAutoCallback((field: keyof SearchOption, value: SearchOption[typeof field]) => {
    setPage(1);
    setSearchOptions((prev) => ({ ...prev, [field]: value }));
    loaderWrapperRef.current?.scrollTo(0, 0);
  });

  const addSchedule = useAutoCallback((lecture: Lecture) => {
    if (!searchInfo) return;

    const { tableId } = searchInfo;

    const schedules = parseSchedule(lecture.schedule).map((schedule) => ({
      ...schedule,
      lecture,
    }));

    setSchedulesMap((prev) => ({
      ...prev,
      [tableId]: [...prev[tableId], ...schedules],
    }));

    onClose();
  });

  const handleQueryChange = useAutoCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    changeSearchOption("query", e.target.value);
  });

  const handleCreditsChange = useAutoCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    changeSearchOption("credits", e.target.value);
  });

  const handleGradesChange = useAutoCallback((value: string[]) => {
    changeSearchOption("grades", value.map(Number));
  });

  const handleDaysChange = useAutoCallback((value: string[]) => {
    changeSearchOption("days", value);
  });

  const handleTimesChange = useAutoCallback((values: string[]) => {
    changeSearchOption("times", values.map(Number));
  });

  const handleMajorsChange = useAutoCallback((values: string[]) => {
    changeSearchOption("majors", values);
  });

  const handleTimeRemove = useAutoCallback((time: number) => {
    changeSearchOption(
      "times",
      searchOptions.times.filter((v) => v !== time)
    );
  });

  const handleMajorRemove = useAutoCallback((major: string) => {
    changeSearchOption(
      "majors",
      searchOptions.majors.filter((v) => v !== major)
    );
  });

  useEffect(() => {
    if (!searchInfo) return;

    // 이미 데이터가 로드되어 있으면 재로딩하지 않음
    if (lectures.length > 0) {
      console.log("이미 로드된 데이터 사용, API 호출 생략");
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

  useEffect(() => {
    const $loader = loaderRef.current;
    const $loaderWrapper = loaderWrapperRef.current;

    if (!$loader || !$loaderWrapper) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prevPage) => Math.min(lastPage, prevPage + 1));
        }
      },
      { threshold: 0, root: $loaderWrapper }
    );

    observer.observe($loader);

    return () => observer.unobserve($loader);
  }, [lastPage]);

  useEffect(() => {
    if (!searchInfo) return;

    setSearchOptions({
      query: "",
      grades: [],
      days: searchInfo?.day ? [searchInfo.day] : [],
      times: searchInfo?.time ? [searchInfo.time] : [],
      majors: [],
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
              <SearchQueryFormControl query={searchOptions.query || ""} onChange={handleQueryChange} />
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

export default SearchDialog;
