/**
 * 注入到学校页面里执行的脚本。每段都是一个 async 函数体，返回值经 TtBridge.post 回传。
 * 只在用户点「导入」（以及进入课表页后探测课程数）时执行；不读表单、不读 Cookie。
 */

export interface ProbeResult {
  url: string;
  title: string;
  /** 页面上有像课表的表格（表头带星期） */
  table: boolean;
  /** 正方课表页的学年/学期选择；移动页使用隐藏字段 */
  zf: { xnm: string[]; xqm: string[]; sel: { xnm: string; xqm: string } } | null;
}

export const PROBE_JS = `
var r = { url: location.href, title: document.title, table: false, zf: null };
var ts = document.getElementsByTagName('table');
for (var i = 0; i < ts.length; i++) {
  if (/星期|周一|Monday|Mon\\b/i.test(ts[i].innerText || '')) { r.table = true; break; }
}
var xn = document.getElementById('xnm'), xq = document.getElementById('xqm');
if (xn && xq && xn.tagName === 'SELECT' && xq.tagName === 'SELECT') {
  var opt = function (sel) {
    return Array.prototype.map.call(sel.options, function (o) { return String(o.value || '').trim(); })
      .filter(function (v) { return v !== ''; });
  };
  r.zf = { xnm: opt(xn), xqm: opt(xq), sel: { xnm: String(xn.value || ''), xqm: String(xq.value || '') } };
} else {
  var mx = document.getElementById('xnm_hide'), mq = document.getElementById('xqm_hide');
  if (mx && mq && mx.value && mq.value) {
    var years = [];
    for (var y = Number(mx.value); y >= Number(mx.value) - 1; y--) years.push(String(y));
    r.zf = { xnm: years, xqm: ['3', '12', '16'], sel: { xnm: mx.value, xqm: mq.value } };
  }
}
return r;
`;

/** 逐周读取移动端课表；周课表记录是实际排课的权威来源。 */
export function zfWeeklyFetchJs(xnm: string, xqm: string): string {
  const term = JSON.stringify({ xnm, xqm });
  return `
var p = location.pathname, i = p.indexOf('/jwglxt/');
var base = i >= 0 ? p.slice(0, i) : '';
var headers = { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json, text/javascript, */*; q=0.01' };
var weekRes = await fetch(base + '/jwglxt/kbcx/xskbcxMobile_cxZc.html', {
  method: 'POST', credentials: 'include', headers: headers, body: new URLSearchParams(${term})
});
if (!weekRes.ok) throw new Error('周次读取失败');
var weeks = await weekRes.json();
if (!Array.isArray(weeks) || !weeks.length) throw new Error('周次读取失败');
var courses = [];
for (var wi = 0; wi < weeks.length; wi++) {
  var z = String(weeks[wi].zs || '');
  if (!/^\\d+$/.test(z)) throw new Error('周次读取失败');
  var res = await fetch(base + '/jwglxt/kbcx/xskbcxMobile_cxXsKb.html', {
    method: 'POST', credentials: 'include', headers: headers,
    body: new URLSearchParams(${term}).toString() + '&zs=' + encodeURIComponent(z) + '&kblx=1&doType=app'
  });
  if (!res.ok) throw new Error('第 ' + z + ' 周课表读取失败');
  var text = await res.text();
  if (/^\\s*<(?:!doctype\\s+html|html)\\b/i.test(text)) throw new Error('登录已失效');
  var data = JSON.parse(text);
  if (!data || !Array.isArray(data.kbList)) throw new Error('课表接口没有返回 kbList');
  for (var ci = 0; ci < data.kbList.length; ci++) {
    var c = data.kbList[ci];
    courses.push({ kcmc: c.kcmc, xm: c.xm, cdmc: c.cdmc, xqj: c.xqj, jcs: c.jcs, zcd: z });
  }
}
return { weeks: weeks.map(function (w) { return { zs: w.zs, rq: w.rq }; }), courses: courses };
`;
}

/** 当前页面 HTML，给通用表格解析 */
export const PAGE_HTML_JS = `return document.documentElement.outerHTML;`;

/** 页面调试包用：主文档与同源子框架的 HTML、编码、文档类型 */
export interface PageCapture {
  url: string;
  title: string;
  charset: string;
  contentType: string;
  readyState: string;
  userAgent: string;
  html: string;
  frames: { src: string; name: string; url: string; charset: string; html: string | null; error: string }[];
}

export const PAGE_CAPTURE_JS = `
var out = {
  url: location.href, title: document.title, charset: document.characterSet || '', contentType: document.contentType || '',
  readyState: document.readyState, userAgent: navigator.userAgent,
  html: document.documentElement ? document.documentElement.outerHTML : '', frames: []
};
var fs = document.querySelectorAll('iframe,frame');
for (var i = 0; i < fs.length; i++) {
  var f = fs[i];
  var item = { src: f.getAttribute('src') || '', name: f.getAttribute('name') || f.id || '', url: '', charset: '', html: null, error: '' };
  try {
    var d = f.contentDocument;
    if (d) {
      item.url = d.location.href; item.charset = d.characterSet || '';
      item.html = d.documentElement ? d.documentElement.outerHTML : '';
    } else item.error = 'no document';
  } catch (e) { item.error = String((e && e.message) || e); }
  out.frames.push(item);
}
return out;
`;

/** 当前页面可见文字，给「让 AI 转换」 */
export const PAGE_TEXT_JS = `return (document.body && document.body.innerText) || '';`;

/**
 * 把函数体包成一次性调用：结果经 TtBridge.post 回传 { id, ok, r | e }。
 * 同步异常和 Promise 拒绝都收进 e。
 */
export function wrapRun(id: string, body: string): string {
  return `(function(){var __id=${JSON.stringify(id)};function __post(o){try{TtBridge.post(JSON.stringify(o))}catch(e){}}
try{Promise.resolve((async function(){${body}\n})()).then(function(r){__post({id:__id,ok:true,r:r===undefined?null:r})},function(e){__post({id:__id,ok:false,e:String((e&&e.message)||e)})})}
catch(e){__post({id:__id,ok:false,e:String((e&&e.message)||e)})}})();`;
}

/** 正方课表页下拉 → 可选学期：当前学年与上一学年，最新的排前 */
export function zfTermOptions(zf: NonNullable<ProbeResult["zf"]>): { xnm: string; xqm: string }[] {
  const years = zf.xnm.map(Number).filter(y => Number.isFinite(y)).sort((a, b) => b - a);
  const cur = Number(zf.sel.xnm);
  const pick = Number.isFinite(cur) && years.includes(cur) ? years.filter(y => y === cur || y === cur - 1) : years.slice(0, 2);
  const order = ["3", "12", "16"];
  const xqms = [...zf.xqm].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const out: { xnm: string; xqm: string }[] = [];
  for (const y of pick) {
    for (const q of xqms) out.push({ xnm: String(y), xqm: q });
  }
  return out;
}
