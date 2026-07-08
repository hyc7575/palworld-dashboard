# Palworld Cloud Run 제어판

Google Compute Engine VM에서 실행되는 Palworld 전용 서버를 제어하기 위한 Next.js App Router 기반 제어판입니다.

## 로컬 개발

1. `.env.example`을 `.env.local`로 복사합니다.
2. GCP나 실제 Palworld 서버 없이 UI/API를 확인하려면 `CONTROL_PANEL_MOCK=true`를 유지합니다.
3. `.env.local`의 placeholder 값을 로컬 테스트용 값으로 바꿉니다.
4. 다음 명령을 실행합니다.

```bash
npm install
npm run dev
```

환경 파일이 없고 `NODE_ENV`가 `production`이 아니면 앱은 기본적으로 mock 모드로 실행됩니다. 이때 기본 mock 로그인 비밀번호는 `palworld`입니다.

## 공개 저장소 보안 주의

이 프로젝트는 public GitHub 저장소에 올릴 수 있지만, 실제 운영 secret은 절대 커밋하지 마세요.

커밋하면 안 되는 값:

- `CONTROL_PANEL_PASSWORD`
- `SESSION_SECRET`
- `PALWORLD_ADMIN_PASSWORD`
- `AUTOSTOP_SECRET`
- GCP 서비스 계정 JSON
- 실제 VM 내부 IP/외부 IP가 민감한 경우 해당 값
- `.env`, `.env.local`, `.env.production` 같은 실제 환경 파일

실제 값은 Cloud Run 환경변수 또는 Secret Manager에만 저장하세요. `.env.example`에는 샘플 placeholder만 둡니다.

## Cloud Run 배포 메모

- 포함된 Dockerfile로 빌드합니다.
- Next.js standalone output을 사용합니다.
- Cloud Run 컨테이너 포트는 `8080`으로 설정합니다.
- 최소 인스턴스는 `0`으로 설정할 수 있습니다.
- Cloud Run 전용 서비스 계정을 사용합니다.
- 민감한 값은 Secret Manager 기반 환경변수로 주입합니다.
- Cloud Run이 VM 내부 IP에 접근할 수 있도록 Direct VPC egress 또는 Serverless VPC Access를 구성합니다.
- Palworld REST API 포트 `8212/tcp`는 VPC 내부에만 열어 둡니다. 필요한 경우 게임 포트 `8211/udp`만 외부에서 접근 가능하게 둡니다.

## 필요한 IAM

Cloud Run 서비스 계정에는 다음 권한이 필요합니다.

- `compute.instances.get`
- `compute.instances.start`
- `compute.instances.stop`
- `compute.zoneOperations.get`
- 설정된 상태 문서에 대한 Firestore 읽기/쓰기 권한
- Secret Manager 기반 환경변수를 사용하는 경우 `roles/secretmanager.secretAccessor`

MVP 구성에서는 `roles/compute.instanceAdmin.v1`을 사용할 수 있지만, 운영에서는 위 권한만 포함한 custom role을 권장합니다.

## Cloud Scheduler

5분마다 `POST /api/autostop`을 호출합니다. 인증은 Cloud Run 서비스 URL을 audience로 설정한 OIDC 방식을 권장합니다. 단순 대안으로 `X-Autostop-Secret` 헤더를 사용하는 공유 secret 방식도 지원합니다.

## 업로드 전 체크리스트

- `node_modules/`, `.next/`, `tsconfig.tsbuildinfo`가 Git에 포함되지 않는지 확인합니다.
- `.env*` 실제 환경 파일과 서비스 계정 키가 없는지 확인합니다.
- GitHub push 후 secret scanning 경고가 없는지 확인합니다.
