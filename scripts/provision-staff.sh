#!/usr/bin/env bash
set -euo pipefail

# Operator-only local tool. Do not source .env or accept credentials as arguments.
if [[ $# -ne 0 ]]; then
  echo '인자를 받지 않습니다. 연결 정보와 비밀번호는 실행 후 입력하세요.' >&2
  exit 1
fi
if [[ ! -t 0 || ! -t 1 ]]; then
  echo '비밀번호를 숨겨 입력할 수 있는 로컬 터미널에서 실행하세요.' >&2
  exit 1
fi

project_root="$(cd "$(dirname "$0")/.." && pwd)"
java_cmd="${JAVA_HOME:+${JAVA_HOME}/bin/}java"
jar_cmd="${JAVA_HOME:+${JAVA_HOME}/bin/}jar"
if ! command -v "$java_cmd" >/dev/null 2>&1; then
  echo 'JDK 21을 찾을 수 없습니다. 설치 후 JAVA_HOME을 JDK 21 폴더로 설정하세요.' >&2
  exit 1
fi
java_version="$("$java_cmd" -version 2>&1 | head -n 1)"
if [[ ! "$java_version" =~ version\ \"21[\.\"] ]]; then
  echo 'JDK 21이 필요합니다. JAVA_HOME을 JDK 21 경로로 설정하세요.' >&2
  exit 1
fi
if ! command -v "$jar_cmd" >/dev/null 2>&1; then
  echo 'JDK의 jar 도구가 필요합니다. JRE 대신 JDK 21을 선택하세요.' >&2
  exit 1
fi

umask 077
tool_directory="$(mktemp -d "${TMPDIR:-/tmp}/rce-provision-staff.XXXXXXXX")"
trap 'rm -rf -- "$tool_directory"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo '운영자 도구의 의존성을 준비합니다. DB 연결이나 서버 시작은 아직 하지 않습니다.'
(
  cd "$project_root/backend"
  ./gradlew bootJar --console=plain --quiet
)
application_jar="$project_root/backend/build/libs/rce-lms-backend-0.1.0.jar"
(
  cd "$tool_directory"
  "$jar_cmd" --extract --file "$application_jar" BOOT-INF/lib
)
"$java_cmd" --class-path "$tool_directory/BOOT-INF/lib/*" \
  "$project_root/backend/tools/ProvisionStaff.java"
