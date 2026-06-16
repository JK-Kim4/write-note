# HWPX 생성 실현가능성 Spike — GitHub #42

날짜: 2026-06-14  
작업 범위: JVM(Kotlin)에서 `.hwpx`(Hancom OWPML) 파일 생성 가능 여부 + 본문 매핑 범위 확인  
결과: **DONE**

---

## (a) 확인된 라이브러리 + 버전 + 출처

| 항목 | 값 |
|---|---|
| groupId | `kr.dogfoot` |
| artifactId | `hwpxlib` |
| 사용 버전 | **1.0.5** (Maven Central 최신 확인 버전) |
| Maven Central 등록 여부 | ✅ 확인 |
| 출처 URL | https://github.com/neolord0/hwpxlib |
| Maven Central 검색 | https://search.maven.org/artifact/kr.dogfoot/hwpxlib |

> **참고:** GitHub README 에는 1.0.8 ~ 1.0.9 가 언급되나, Maven Central 에 실제 등록된 최신은 1.0.5 (2025-01 기준). 향후 최신 버전 확인 후 업그레이드 검토.

---

## (b) 최소 생성 성공 + 파일 경로

테스트 클래스: `backend/src/test/kotlin/com/writenote/spike/HwpxSpikeTest.kt`  
실행 명령: `./gradlew test --tests "com.writenote.spike.HwpxSpikeTest" --rerun-tasks`  
결과: **BUILD SUCCESSFUL** — 6개 `.hwpx` 파일 모두 생성 완료

### 생성된 파일 (사용자 한컴오피스 직접 열기 필요)

| 파일명 | 절대 경로 | 검증 항목 |
|---|---|---|
| `minimal.hwpx` | `/Users/jongwan-air/Desktop/workspaces/write-note/backend/build/spike/minimal.hwpx` | 최소 단락 "안녕하세요, 나래 노트입니다." |
| `multiple-paragraphs.hwpx` | `/Users/jongwan-air/Desktop/workspaces/write-note/backend/build/spike/multiple-paragraphs.hwpx` | 3개 단락 표시 여부 |
| `heading-styles.hwpx` | `/Users/jongwan-air/Desktop/workspaces/write-note/backend/build/spike/heading-styles.hwpx` | 제목1~3 스타일 적용 여부 |
| `bold-italic.hwpx` | `/Users/jongwan-air/Desktop/workspaces/write-note/backend/build/spike/bold-italic.hwpx` | 볼드/이탤릭 렌더링 여부 |
| `paper-size-a4.hwpx` | `/Users/jongwan-air/Desktop/workspaces/write-note/backend/build/spike/paper-size-a4.hwpx` | A4 용지 크기 적용 여부 |
| `korean-font.hwpx` | `/Users/jongwan-air/Desktop/workspaces/write-note/backend/build/spike/korean-font.hwpx` | 나눔명조 폰트 적용 여부 |

---

## (c) 매핑 범위 표 (Step 3 탐색 결과)

| 요소 | 가능/제약/불가 | 비고 |
|---|---|---|
| **단일 단락 + 한국어 텍스트** | ✅ 가능 | `section.addNewPara()` → `para.addNewRun()` → `run.addNewT().addText("한글")` — API 직관적, 오류 없음 |
| **복수 단락** | ✅ 가능 | `addNewPara()` 반복 호출로 자연스럽게 추가됨 |
| **제목 스타일 (H1~H3)** | ⚠️ 제약 | `para.styleIDRefAnd("1")` 등으로 참조 가능. 단, BlankFileMaker 기본 헤더에 H1~H3 스타일 정의가 없음 → 한컴오피스 내장 스타일 ID와 일치 여부에 따라 렌더링 결과 달라짐. 완전한 구현에는 헤더 스타일 섹션에 직접 제목 스타일을 정의해야 함 |
| **볼드 / 이탤릭** | ✅ 가능 (단, 작업 필요) | `charProps.addNew()` 후 `charPr.createBold()` / `createItalic()` 로 CharPr 정의 가능. charPrIDRef 로 참조하는 방식 — 직접 setter 없어 헤더 CharPr 사전 정의 필요 |
| **용지 크기 (A4, B4)** | ⚠️ 제약 | `run.createSecPr()` → `secPr.createPagePr()` → `pagePr.widthAnd(21000).heightAnd(29700)` 경로 존재. 단, secPr 가 Para 레벨이 아닌 Run 레벨에 달림 — OWPML 표준과 실제 렌더 동작 간 격차 한컴 확인 필요 |
| **한국어 폰트 지정** | ✅ 가능 | `fontfaces.hangulFontface().getFont(0).faceAnd("나눔명조")` — API 깔끔. 단, 시스템에 해당 폰트가 없으면 한컴이 대체 폰트 사용 |

---

## (d) Phase 5 권장 사항

### 결론: **실현가능 (범위 한정)**

`hwpxlib 1.0.5` 로 JVM에서 `.hwpx` 파일 생성은 **실현가능**하다. 다만 아래 제약을 인지하고 범위를 한정해야 한다.

**할 수 있는 것 (Phase 5 scope-in)**
- 본문 단락 → HWPX 단락 1:1 매핑 (텍스트 추출 후 단락 생성)
- 한국어 텍스트 생성 (UTF-8 처리됨)
- 한국어 폰트 (바탕/나눔명조 등) 헤더 지정
- 볼드/이탤릭 (헤더 CharPr 사전 정의 방식)
- 기본 A4 용지 설정

**제약 / 후속 확인 필요**
- H1~H3 제목 스타일: 헤더에 스타일 정의를 직접 추가하거나, 실제 한컴오피스 스타일 ID 매핑 표 필요
- 용지 크기 적용 위치 (Run.secPr vs Section 수준): 실제 한컴 열기로 최종 확인 필요
- `hwpxlib` 1.0.5가 Maven Central 최신 — GitHub의 1.0.8/1.0.9는 미발행 상태. 기능 격차 존재 가능성

**대안 (선택지)**
- **docx 우선**: Apache POI (`docx4j` 또는 `poi-ooxml`) 는 Java 생태계에서 성숙도·문서 품질이 훨씬 높음. 한국 사용자도 Word에서 hwpx로 변환 가능. Phase 5 를 docx 우선으로 진행하고 hwpx는 후속 이관으로 분리하는 안 검토 가치 있음.

---

## (e) 노력 추정 (업데이트)

| 작업 | 예상 공수 |
|---|---|
| 본문 단락 → HWPX 변환 (텍스트 추출 + Para 생성) | 0.5일 |
| 볼드/이탤릭/폰트 헤더 설정 | 0.5일 |
| 제목 스타일 정의 (스타일 ID 매핑 포함) | 1일 |
| 다운로드 API 연동 (`HWPXWriter.toStream` → HTTP response) | 0.5일 |
| 한컴오피스 dogfooding + 엣지케이스 픽스 | 1일 |
| **합계** | **3.5일** |

> docx 우선 방안은 Apache POI 성숙도 덕분에 1~2일 단축 가능.

---

## 테스트 코드 위치

`backend/src/test/kotlin/com/writenote/spike/HwpxSpikeTest.kt`

의존성 (test scope):
```kotlin
testImplementation("kr.dogfoot:hwpxlib:1.0.5")
```
