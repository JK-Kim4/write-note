# Contract — 보드 API (트랙 B rename 후)

base: `/api/boards` (불변). 응답 envelope `Result<T>`(불변). 인증 `@AuthenticationPrincipal`(불변). **동작·검증·상태코드 모두 불변** — 경로 segment·필드명·DTO명만 rename.

## 보드 (불변)
| 메서드 | 경로 | 변경 |
|---|---|---|
| POST | `/api/boards` | — |
| GET | `/api/boards` | — |
| GET | `/api/boards/{boardId}` | 응답 본문 키 `nodes`→`cards`, `edges`→`links` (아래) |
| PATCH | `/api/boards/{boardId}` (rename) | — |
| DELETE | `/api/boards/{boardId}` | — |
| PATCH | `/api/boards/{boardId}/project` | — |
| PATCH | `/api/boards/{boardId}/category` | — |
| PATCH | `/api/boards/{boardId}/viewport` | — |

## 카드 (구 노드) — segment `/nodes`→`/cards`
| 메서드 | 경로(전) | 경로(후) | DTO |
|---|---|---|---|
| POST | `/{boardId}/nodes` | `/{boardId}/cards` | req `CreateCardRequest` → res `CardResponse` (201) |
| PATCH | `/{boardId}/nodes/{nodeId}` | `/{boardId}/cards/{cardId}` | req `UpdateCardRequest` → res `CardResponse` |
| PATCH | `/{boardId}/nodes` | `/{boardId}/cards` | req `List<BatchCardPositionItem>` → res `List<CardResponse>` (배치 위치) |
| DELETE | `/{boardId}/nodes/{nodeId}` | `/{boardId}/cards/{cardId}` | 204 (연결 cascade) |

`CardResponse` = { id, boardId, body, posX, posY, zIndex, type, createdAt, updatedAt } (필드명 불변 — node/edge 없음)

## 연결 (구 엣지) — segment `/edges`→`/links`
| 메서드 | 경로(전) | 경로(후) | DTO |
|---|---|---|---|
| POST | `/{boardId}/edges` | `/{boardId}/links` | req `CreateLinkRequest` → res `LinkResponse` (201) |
| DELETE | `/{boardId}/edges/{edgeId}` | `/{boardId}/links/{linkId}` | 204 |

- `CreateLinkRequest` = { **sourceCardId**, **targetCardId**, sourceHandle?, targetHandle? } (구 sourceNodeId/targetNodeId)
- `LinkResponse` = { id, boardId, **sourceCardId**, **targetCardId**, sourceHandle?, targetHandle?, createdAt }

## 하이드레이션 — `GET /{boardId}` 응답 본문
```jsonc
// BoardDetailResponse
{
  "board": { /* BoardResponse 불변 */ },
  "cards": [ /* CardResponse[] (구 nodes) */ ],
  "links": [ /* LinkResponse[] (구 edges) */ ]
}
```

## 에러코드 (불변 동작, 식별자만)
| 전 | 후 | status | 메시지 |
|---|---|---|---|
| `BOARD_EDGE_INVALID` | `BOARD_LINK_INVALID` | 400 | "연결할 수 없는 카드입니다(자기 연결·다른 보드·없는 카드)." (노드→카드) |
| `BOARD_EDGE_DUPLICATE` | `BOARD_LINK_DUPLICATE` | 409 | "이미 존재하는 연결입니다." (불변) |
| `BOARD_PROJECT_ALREADY_MAPPED` | (불변) | 409 | (불변) |
| `BOARD_CATEGORY_ALREADY_MAPPED` | (불변) | 409 | (불변) |

> FE `client.ts`/훅의 `error.code` 분기가 `BOARD_EDGE_*`를 참조하면 `BOARD_LINK_*`로 동기(grep). 동작·status 불변이라 분기 로직 자체는 동일.

## 검증 의미 (전부 불변)
- 연결 생성: source≠target(400 INVALID), 같은 보드의 존재 카드(400 INVALID), 정확 순서쌍 중복(409 DUPLICATE).
- 카드/연결은 `findByIdAndUserId`(보드 소유) 게이트 — 타 사용자 접근 차단(불변).
