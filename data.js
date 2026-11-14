/*
  사이트 내용은 이 파일만 고치면 됩니다.

  새 스크립트 올리는 법
  1) scripts 폴더 안에 새 폴더를 만듭니다. 폴더 이름은 영문 소문자·숫자·하이픈만 (예: scripts/text-bounce)
  2) 그 폴더에 스크립트 파일(.jsx)과 시연 영상(.mp4)을 넣습니다.
  3) 아래 SCRIPTS 목록 맨 위에 항목 하나를 복사해 붙여넣고 내용을 바꿉니다.
     - 썸네일은 따로 만들 필요 없습니다. 카드 영상의 thumbAt 초 지점 화면이 자동으로 썸네일이 됩니다.
     - 카드 영상은 preview(짧은 반복 영상)이고, 없으면 video를 그대로 씁니다. thumbAt은 카드 영상 기준 초입니다.
     - video는 상세 화면에서 재생되는 전체 시연 영상입니다.
     - 목록 맨 위 항목이 첫 화면에 크게 소개됩니다.
*/

window.SITE = {
  name: "c1 scripts",
  intro: "",                        // 헤더 옆 소개 문구. 비워두면 표시 안 함
  author: "",                       // 비워두면 표시 안 함
  links: [                          // 비워두면 표시 안 함. 예: { label: "Instagram", url: "https://instagram.com/..." }
  ]
};

/* 카테고리: 에펙 레이어 라벨 색을 그대로 씁니다. 새 카테고리는 여기에 한 줄 추가 */
window.CATEGORIES = {
  "정렬":   "#4ab0a8",   // Aqua
  "레이어": "#e4d84c",   // Yellow
  "애니메이션": "#e5bcc9", // Pink
  "유틸":   "#a9a9ca"    // Lavender
};

window.SCRIPTS = [
  {
    id: "random-flicker",
    name: "Random Flicker",
    version: "1.0",
    date: "2026-11-14",
    category: "애니메이션",
    summary: "셰이프 그룹이나 레이어를 무작위로 깜빡이게 합니다. 뚝뚝 끊기는 깜빡임과 부드러운 디졸브 중에서 고릅니다.",
    description: "레이어를 선택하고 적용을 누르면 Opacity에 익스프레션이 들어가 무작위로 켜지고 꺼집니다. 셰이프 레이어는 안쪽 그룹(Ellipse 등) 하나하나가 따로 깜빡이고, 레이어 단위로도 걸 수 있습니다. 컨트롤러를 켜두면 Flicker Controller Null 레이어가 생겨서, 속도·확률·밝기·시드를 나중에 슬라이더로 다시 조절할 수 있습니다.",
    features: [
      "셰이프 그룹 단위 또는 레이어 단위로 적용",
      "몇 프레임마다 바뀔지 설정 (초당 변경 횟수 표시)",
      "깜빡임 / 디졸브 전환, 디졸브 길이와 이징",
      "켜져 있을 확률, 켜짐·꺼짐 Opacity, 시드",
      "Flicker Controller 레이어로 적용 후에도 조절",
      "효과 제거 버튼으로 익스프레션 삭제"
    ],
    install: [
      "After Effects에서 File › Scripts › Run Script File… 을 누르고 RandomFlicker.jsx를 고릅니다.",
      "깜빡이게 할 레이어를 선택하고 설정 창에서 적용을 누릅니다.",
      "자주 쓴다면 After Effects 설치 폴더의 Scripts 폴더에 넣어두면 File › Scripts 메뉴에 바로 나타납니다."
    ],
    file: "scripts/random-flicker/RandomFlicker.jsx",
    video: "scripts/random-flicker/demo.mp4",
    preview: "scripts/random-flicker/preview.mp4",
    thumbAt: 1.0
  },
  {
    id: "allign-c1",
    name: "Allign.c1",
    version: "1.0",
    date: "2026-11-14",
    category: "정렬",
    summary: "기준 레이어 A는 고정하고, 선택한 레이어만 A 안에서 9방향으로 정렬합니다.",
    description: "에펙 기본 정렬은 선택한 레이어들의 중간으로 맞추기 때문에 기준이 같이 움직입니다. Allign.c1은 빨간 버튼으로 기준(A)을 정해두면 A는 그대로 두고 나머지 레이어만 A의 보이는 영역에 맞춥니다. 기준을 정하지 않으면 컴포지션 크기에 맞춥니다. 레이어 상단 고정(PinToTop) 버튼 4개도 함께 들어 있습니다.",
    features: [
      "9방향 정렬: 왼쪽 위부터 오른쪽 아래, 정중앙까지",
      "기준 미지정 시 컴포지션 기준 정렬",
      "앵커 포인트 위치와 상관없이 눈에 보이는 영역 기준",
      "부모 레이어, 회전, 스케일이 있어도 정확하게 정렬",
      "키프레임이 있으면 현재 시간에 키 추가",
      "Ctrl+Z 한 번으로 되돌리기"
    ],
    install: [
      "After Effects에서 File › Scripts › Install ScriptUI Panel… 을 누르고 Allign.c1.jsx를 고릅니다.",
      "After Effects를 다시 실행합니다.",
      "Window 메뉴 맨 아래 Allign.c1.jsx를 열고, 원하는 패널 옆에 끌어다 붙입니다."
    ],
    file: "scripts/allign-c1/Allign.c1.jsx",
    video: "scripts/allign-c1/demo.mp4",
    preview: "scripts/allign-c1/preview.mp4",
    thumbAt: 2.4
  }
];
