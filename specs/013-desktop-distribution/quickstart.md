# Quickstart: Desktop 앱 배포 (013)

릴리스 담당자(개발자)와 검증 절차용. 구현 완료 후 본 절차가 동작해야 한다.

## 릴리스 절차 (개발자)

```bash
# 1. 버전 상향
#    desktop/package.json "version" 수정 (예: 0.0.0 → 0.1.0)

# 2. 커밋 + 태그 + push
git add desktop/package.json
git commit -m "chore(desktop): release v0.1.0"
git tag v0.1.0
git push origin <branch>
git push origin v0.1.0

# 3. GitHub Actions가 자동으로:
#    - macos-latest → Soseolbi-Note.dmg (universal, ad-hoc)
#    - windows-latest → Soseolbi-Note-Setup.exe (NSIS)
#    - 둘 다 Release v0.1.0에 업로드
#    진행: GitHub repo → Actions 탭
```

## 검증 게이트 (구현 완료 판단 기준)

### G1. 파이프라인 (US1 / SC-002)
- [ ] 테스트 태그(예: `v0.0.1-test`) push → Actions에서 양 OS job GREEN
- [ ] Release에 `Soseolbi-Note.dmg` + `Soseolbi-Note-Setup.exe` 자동 업로드(수동 0회)
- [ ] 한쪽 OS job을 일부러 실패시켜도 다른 OS 자산은 정상 게시되는지(`fail-fast:false`)

### G2. macOS 실제 설치 ⚠️ 최대 리스크 (R3 / FR-006/007)
- [ ] **빌드한 Mac이 아닌 다른 Mac**(또는 `xattr -w com.apple.quarantine` 부여)에서 `Soseolbi-Note.dmg` 다운로드
- [ ] dmg 열어 앱을 응용 프로그램으로 드래그 → 첫 실행 차단 확인
- [ ] **시스템 설정 → 개인정보 보호 및 보안 → "확인 없이 열기"** → 앱 실행 성공
- [ ] Apple Silicon + (가능하면) Intel Mac 양쪽 실행
- [ ] **실패 시**: ad-hoc 배포 불가 결론 → macOS Apple Developer 서명+공증($99/년)으로 fallback (별도 트랙)

### G3. Windows 실제 설치 (US2 / FR-008)
- [ ] `Soseolbi-Note-Setup.exe` 다운로드 → 실행
- [ ] SmartScreen "Windows의 PC 보호" → 추가 정보 → 실행
- [ ] 관리자 권한 프롬프트 없이 설치 완료 + 앱 실행

### G4. 기능 회귀 (FR-009)
- [ ] 설치된 앱에서 기존 기능(집필실·메모·기록) 정상 — 로컬 `node:sqlite` DB 생성·읽기·쓰기 확인

### G5. 다운로드 페이지 (US2 / US3 / SC-003/004)
- [ ] `/download` 접속 → 방문 OS 우선 강조 + 양 OS 버튼 노출
- [ ] 각 버튼이 `releases/latest/download/<파일명>`으로 정상 다운로드
- [ ] 설치 안내문(Windows/macOS) 한국어로 단계 표시
- [ ] 새 버전 게시 후 동일 링크가 최신 받는지(링크 불변)

## 알려진 한계 (사용자 합의됨)
- 무서명이라 양 OS 첫 실행에 수동 단계 존재(특히 macOS Sequoia 시스템 설정 경로). 1-click을 원하면 macOS 서명이 가장 효과적.
- 자동 업데이트 없음 — 새 버전은 재다운로드.
