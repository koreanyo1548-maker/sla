/* ===== assets.js ===== */
/* 표시 자산 경로표. 경로는 진입점(index.html) 기준 상대 경로다 — CrazyGames는
   번들 안의 참조에 상대 경로만 허용한다(절대 경로는 로드에 실패한다).

   [2026-09-18 세션 1] index.html 안의 base64 9장을 이 파일로 옮겼다.
   [2026-09-18 세션 2] 마지막까지 base64로 남아 있던 fighters_01~03도 파일로 뺐다.
     이 3장은 GameArt.prepareFighterAtlas가 getImageData로 초록 배경 색키를
     지우는 대상이라, file:// 로 열면 파일에서 온 이미지가 캔버스를 오염시켜
     픽셀을 읽을 수 없다. 그래서 개발 진입점(dev.html)이 js/assets-dev.js로
     이 3장만 인라인 data URL로 덮어써 file:// 더블클릭에서도 색키가 돈다.
     출시 진입점(index.html)은 파일을 그대로 쓴다 — https로 서비스되므로
     오염이 없고, base64 1.35MB가 파서를 막지 않는다. */
const ASSET_URLS={
  "forge_lobby":"assets/forge_lobby.webp",
  "heroes_01":"assets/heroes_01.webp",
  "heroes_02":"assets/heroes_02.webp",
  "heroes_03":"assets/heroes_03.webp",
  "battlefield":"assets/battlefield.webp",
  "battle_sprites":"assets/battle_sprites.webp",
  "fighters_01":"assets/fighters_01.webp",
  "fighters_02":"assets/fighters_02.webp",
  "fighters_03":"assets/fighters_03.webp",
};
