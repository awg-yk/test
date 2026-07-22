/**
 * regionSelector.js
 * ------------------------------------------------------------
 * [フェーズ2で実装予定]
 * 地方（北海道・東北・関東 …）および都道府県単位の
 * 一括選択チェックボックスUIと、選択状態から
 * 「表示すべき観測所」を絞り込むロジックをここに実装する。
 *
 * 想定するAPI（フェーズ2でのインターフェース案）:
 *
 *   initRegionSelector({
 *     container: HTMLElement,   // 描画先
 *     regions: Region[],        // data/stations.json の regions
 *     onChange: (selectedPrefectures: Set<string>) => void,
 *   })
 *
 * 選択ロジックの方針:
 *   - 地方チェックボックスON → 配下の全都道府県をON（indeterminate表現も検討）
 *   - 都道府県を一部だけ外す → 地方チェックボックスは indeterminate 状態に
 *   - 最終的な絞り込みは「都道府県の集合」を正とし、
 *     stationList 側は station.prefecture が集合に含まれるかで判定する
 */

export function initRegionSelector(/* options */) {
  // TODO(フェーズ2): 地方・都道府県の階層チェックボックスを実装
  console.info("[regionSelector] フェーズ2で実装予定です。");
}
