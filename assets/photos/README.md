# 메인 후기·사진 데이터 (assets/testimonials.json, assets/photos.json)

두 파일 모두 JSON 배열입니다. 비어 있으면(`[]`) 메인의 '설계사 후기'·'현장 사진' 섹션은 화면에 전혀 나오지 않습니다.
그리는 코드: assets/glass-main.js. 자세한 넣는 방법: 저장소 밖 ../reports/S2-후기사진-넣는법.md

## testimonials.json 항목 (consent 가 true 인 것만 표시, 최대 3개)
```json
[
  {"quote": "후기 본문(본인이 쓴 그대로)", "name": "홍O동 (이니셜 가능)", "role": "188본부 설계사", "since": "2023년 합류", "consent": true}
]
```

## photos.json 항목 (최대 6장, 사진 파일은 이 폴더 assets/photos/ 에 둠)
```json
[
  {"src": "assets/photos/2026-03-연도대상.jpg", "alt": "사진 설명(화면 낭독용)", "caption": "사진 아래 한 줄", "width": 1200, "height": 900}
]
```
- 가짜 후기·가짜 사진·인물 합성 금지. 후기는 본인 동의(consent) 없이 올리지 않습니다.
- 사진은 1200px 폭·300KB 이하 권장, 외부 주소 대신 이 폴더에 둡니다.
