# Research — 자동저장 재설계

설계 SoT([`DESIGN-localstorage-autosave.md`](../015-web-port-frontend/DESIGN-localstorage-autosave.md))에서 확정된 결정을 speckit 형식으로 정리한다. 미해결 NEEDS CLARIFICATION 없음.

## R1. 편집 세션을 버전의 단일 기준으로 — 거짓 충돌 근본 원인 제거

- **Decision**: 집필실 진입 시 document 를 1회 로드한 뒤, 편집 세션 동안 서버 재조회(refetch)를 차단한다(`useProjectDocument` 에 `staleTime: Infinity`, 편집 중 invalidate 금지). 버전은 **저장(PUT) 응답으로만** 갱신한다.
- **Rationale**: 거짓 409 의 뿌리는 편집 중 끼어든 GET 의 (이미 저장으로 추월된) 버전이 저장용 버전을 stale 로 되돌리는 것. 버전의 출처를 한 곳(편집 세션)으로 모으면 이 경로가 구조적으로 사라진다.
- **Alternatives considered**:
  - `refetchOnWindowFocus/Reconnect` 만 차단(015 의 3차 시도) — 반복 GET 의 다른 트리거가 남아 재발. 완화에 그침.
  - version 전진-only 가드(015 의 2차 시도) — 증상 억제일 뿐 출처 분산은 그대로.
  - 서버 버전 폐기, 클라이언트 카운터 — 비동기 공동 집필의 충돌 감지 토대 붕괴. 탈락.

## R2. localStorage draft — 로컬 우선 보존 + 복구 안전망

- **Decision**: 타자마다 작품별 `localStorage` 키(`wn:draft:doc:{documentId}`)에 `{body, baseVersion, dirty, updatedAt}` 을 즉시 기록한다. 순수 함수 모듈 `draftStore.ts` 로 분리(SSR 가드는 기존 `lib/lastProject.ts` 패턴 재사용).
- **Rationale**: 네트워크 왕복 없이 입력 반응성 확보 + 동기화 전 중단(탭닫기·크래시) 시 작성분 보존. 순수 모듈이라 단위 테스트가 쉽다.
- **Alternatives considered**:
  - Zustand persist — 이미 `preferences` 에 쓰나, draft 는 작품별 동적 키 + 세션 라이프사이클이라 전용 모듈이 명확. 
  - IndexedDB — 단일 문서 수십~수백KB 규모엔 과함(localStorage 5MB 한계 내). YAGNI.

## R3. 하이브리드 동기화 — 멈춤 1.5초 또는 상한 10초

- **Decision**: 미동기화 draft 를 "타자 멈춤 1.5초 경과" 또는 "마지막 동기화 후 10초 경과" 중 먼저 도래하는 시점에 PUT 한다.
- **Rationale**: 멈추면 빨리 안전(desktop 700ms debounce 감각과 유사), 쉬지 않고 써도 10초 상한으로 미동기화 구간을 묶는다(SC-004). PUT 빈도가 매 타자→드물게로 줄어 동시 PUT 경합도 함께 감소.
- **하이브리드 타이머 정확값**: 멈춤 지연 **1.5초**(설계의 "1~2초" 구체화), 상한 **10초**. 테스트 주입 가능하게 파라미터화(`debounceMs`/`maxIntervalMs`).
- **Alternatives considered**: 순수 10초 주기 — 멈춰도 최대 10초 미반영. 멈춤만(idle) — 연속 타자 시 무한 미반영. 둘 다 단독은 약점.

## R4. in-flight 저장 가드

- **Decision**: 저장이 진행 중이면 새 저장을 큐잉했다가 완료 후 dirty 면 1회 재저장한다(`isSavingRef`).
- **Rationale**: 같은 baseVersion 으로 두 PUT 이 겹쳐 뒤엣것이 stale 되는 경합(015 §3-d) 차단. R1 으로 GET 경로는 막히지만 저장 경로 경합은 별도 가드가 명확.

## R5. 백엔드 버전 토큰 — `updatedAt: Instant` 에 `@Version` 겸용

- **Decision**: `Document.version: Int` 컬럼 제거. `updatedAt: Instant` 에 `@Version` 부여. `@PreUpdate` 의 `updatedAt = Instant.now()` 수동 set 제거(Hibernate 가 flush 시 자동 set). `@PrePersist` 의 `createdAt` 초기화는 유지.
- **Rationale**: 수정 시각 = 낙관적 잠금 토큰 겸용으로 컬럼 통합. 표시용 시각과 충돌 판정 기준이 한 값.
- **검증 완료**: Hibernate ORM 공식 문서(`introduction/Entities.adoc`, `userguide/.../Locking.adoc`, `OptimisticLockingInstantTest`)가 `@Version` 에 `Instant`/`LocalDateTime`/`OffsetDateTime`/`ZonedDateTime` 지원을 명시. numeric 이 typical 권장이나 temporal 도 정식 지원.
- **Trade-off**: temporal `@Version` 은 같은 시각 해상도 안의 두 저장이 충돌을 놓칠 수 있음(numeric `+1` 은 구조적 불가). PUT 이 드물고 Postgres timestamp 마이크로초 해상도라 실무 위험 낮음 — 수용(spec Assumptions).
- **Alternatives considered**: 별도 `version` 컬럼만 datetime 으로 교체(updatedAt 별도 유지) — 사용자 결정상 "겸용"으로 통합. 정수 유지 + R1 만으로 해결 — 사용자가 datetime 명시 요구.

## R6. 저장 응답의 버전 — flush 후 읽기

- **Decision**: `performSave` 에서 body 저장 후 `flush`(또는 `saveAndFlush`)하여 Hibernate 가 set 한 새 `updatedAt` 을 응답 `version` 으로 반환한다.
- **Rationale**: 정수는 `version + 1` 로 예측 가능했으나, datetime 의 다음 값은 예측 불가 → flush 시점에 확정된 실제 값을 읽어야 정확. 트랜잭션 내 flush 로 동일 요청에서 보장.

## R7. API 계약 — version 불투명 문자열 토큰

- **Decision**: `version`·`currentVersion` 의 와이어 타입을 `number` → ISO8601 **문자열**로. 프론트는 파싱·증감 없이 **불투명 토큰**으로 비교·전달(draft `baseVersion` 도 문자열). 409 분기는 `error.code === "DOCUMENT_VERSION_CONFLICT"` 한정 유지(이메일 중복 409 회귀 가드).
- **Rationale**: datetime 직렬화는 문자열이 자연스럽고, 프론트가 토큰 의미에 의존하지 않으므로 백엔드 표현 변경에 견고.
- **영향 범위**: `DocumentResponse`/`SaveDocumentRequest`/`DocumentSaveResponse`/`DocumentConflictResponse`(백엔드), `types/api.ts`/`client.ts`/`document.ts`/`ConflictDialog.tsx`(프론트).

## R8. 복구 UX — [복구]/[버리기] 배너

- **Decision**: 진입 시 dirty draft 가 있고 `baseVersion === 서버 version` 이면 복구 배너(`RecoverBanner`)로 [복구]/[버리기] 제시. `baseVersion ≠ 서버 version`(그 사이 타 저장)이면 충돌 경로(ConflictDialog)로 합류. 동기화 성공 draft 는 즉시 삭제하지 않고 다음 진입 시 정리.
- **Rationale**: 작성분 처리를 사용자 명시 통제로. 동기화 직후 크래시에도 복구 여지(즉시 삭제 안 함).

## 미해결 사항

없음. 모든 기술 결정 확정·검증 완료.
