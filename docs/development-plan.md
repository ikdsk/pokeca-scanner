---
created: 2026-10-05
status: P1
---
# Pokéca Scanner 開発計画

## 目的
スマホで「開く→かざす→日本語でポケカと海外参考価格が分かる」をMTG版（Mana Peek）と同じ軽快さで実現する。

## 決定事項（2026-10-05 ユーザー合意）
- MTG版 `release/issue22-candidate-immersive`（5ed9293）をベースに別リポジトリで開発。
- 認識: CollectorVision `pokemon-japan`（TCGplayer由来、27,593件・2026-10-04時点。MTG以外はプレビュー扱い）。
- 日本語: TCGdex `ja`。TCGplayer商品IDで突合し、一致しない候補は表示しない。
- 価格: MTG同様、US価格（TCGplayer）を海外参考価格として USD＋概算JPY 表示。
- 晴れる屋2: 外部検索リンクのみ。価格の取得・保存・転載はしない（規約上の配慮）。
- 開発体制: コーディネーター Opus 5.5、サブエージェント Sonnet 5.5、worktree分離、進捗はGitHub Issues。

## フェーズ
- P0 BOOT-01（#1）: 名称・文書・契約の切り替え、CI green。
- P1 並行: VISION（#2）・DATA（#3）・PRICE（#4）・UI（#5）。
- P1 統合 → QA（#6）: 実カード精度、日本語表示、価格の正しさ、レイテンシー。実機は証拠がなければ NOT RUN。
- 公開・デプロイ・価格プロキシの公開はユーザー承認後。

## 既知のリスク
- `pokemon-japan` の認識精度は未検証（Miloは MTG で学習）。
- TCGplayer の日本版価格は米国市場の参考値で、国内相場とは乖離しうる。
- TCGCSV に CORS がないため、価格はビルド時スナップショットかプロキシが必要。
- TCGdex と TCGplayer のセット命名差（プロモ・旧弾）で突合できないカードがある。
