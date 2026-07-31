// 広告枠（既定では何も表示しない）
//
// 収益化の準備だけ先に入れておくための仕組み。
// config.js に設定を書いたときだけ広告を読み込む。設定が無ければ完全な無反応で、
// 通信もしないためオフライン動作を一切壊さない。
//
// 使い方（AdSense の審査に通ったあと）:
//   config.js を作り、次のように書く。
//     export const ADS = { provider: 'adsense', client: 'ca-pub-XXXXXXXXXXXXXXXX', slot: 'YYYYYYYYYY' };

let conf = null;
let loaded = false;

export async function initAds() {
  try {
    const m = await import('../config.js');
    conf = m.ADS || null;
  } catch {
    conf = null;   // config.js が無いのが既定。何もしない
  }
  return conf;
}

/** 指定した要素に広告を表示する。未設定・オフラインなら何もしない */
export function showAd(container) {
  if (!conf || conf.provider !== 'adsense' || !container) return false;
  if (!navigator.onLine) return false;

  if (!loaded) {
    loaded = true;
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(conf.client)}`;
    document.head.append(s);
  }

  container.textContent = '';
  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.cssText = 'display:block;width:100%;min-height:60px';
  ins.setAttribute('data-ad-client', conf.client);
  ins.setAttribute('data-ad-slot', conf.slot);
  ins.setAttribute('data-ad-format', 'auto');
  ins.setAttribute('data-full-width-responsive', 'true');
  container.append(ins);
  container.style.display = 'block';
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* 失敗しても本体に影響させない */ }
  return true;
}
