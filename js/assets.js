/* ===== assets.js ===== */
/* 표시 자산 경로표. 경로는 진입점(index.html) 기준 상대 경로다 — CrazyGames는
   번들 안의 참조에 상대 경로만 허용한다(절대 경로는 로드에 실패한다).

   [2026-09-18 세션 1] index.html 안의 base64 9장을 이 파일로 옮겼다.
   [2026-09-18 세션 2] 마지막까지 base64로 남아 있던 fighters_01~03도 파일로 뺐다.
   [2026-09-18] fighters 3장이 알파를 갖게 돼(인철이 누끼) 런타임 색키를 걷어냈다.
     색키가 없으면 getImageData가 필요 없고, 그러면 file:// 에서 캔버스가 오염되는
     문제 자체가 사라진다. 9장 모두 특례 없이 같은 경로다.
   [2026-09-18] 개발 진입점(dev.html)을 지워 진입점은 index.html 하나뿐이다. */
// [2026-09-24] v2 아틀라스는 생성 원본을 오프라인에서 실제 알파로 변환했다.
// 기존 초상화·전장·로비와 캐릭터 순서는 유지하며 런타임 색키 처리는 없다.
const ASSET_URLS={
  "forge_lobby":"assets/forge_lobby.webp",
  "heroes_01":"assets/heroes_01.webp",
  "heroes_02":"assets/heroes_02.webp",
  "heroes_03":"assets/heroes_03.webp",
  "battlefield":"assets/battlefield.webp",
  "battle_sprites":"assets/battle_sprites_v2.webp",
  "fighters_01":"assets/fighters_01_v2.webp",
  "fighters_02":"assets/fighters_02_v2.webp",
  "fighters_03":"assets/fighters_03_v2.webp",
};
