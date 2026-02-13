/* app.js — client-side logic for layout and drawing */
(function(){
  const $ = id => document.getElementById(id);
  const canvas = $('canvas');

  // Inputs
  const inputs = ['L_axes','L_edges','D_left','D_right','el_type','w','s','a_min','a_max','g_target','n_manual'];
  const els = {};
  inputs.forEach(id=>els[id]=$(id));

  const autofitBtn = $('autofit');
  const decN = $('dec_n');
  const incN = $('inc_n');
  const printBtn = $('print');
  const exportBtn = $('export');
  const results = $('results');
  const svg = document.getElementById('canvas');

  function toNum(v){return Number(v)||0}

  // Sync fields: L_edges = L_axes - (D_left/2 + D_right/2)
  function syncEdgesFromAxes(){
    const L_axes = toNum(els.L_axes.value);
    const D_left = toNum(els.D_left.value);
    const D_right = toNum(els.D_right.value);
    // L_axes is distance between centers; edges span is total minus both radii
    const edges = Math.max(0, L_axes - (D_left/2 + D_right/2));
    els.L_edges.value = Math.round(edges);
  }
  function syncAxesFromEdges(){
    const L_edges = toNum(els.L_edges.value);
    const D_left = toNum(els.D_left.value);
    const D_right = toNum(els.D_right.value);
    const axes = Math.max(0, L_edges + (D_left/2 + D_right/2));
    els.L_axes.value = Math.round(axes);
  }

  ['L_axes','D_left','D_right'].forEach(id=>$(id).addEventListener('input',syncEdgesFromAxes));
  $('L_edges').addEventListener('input',syncAxesFromEdges);

  function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

  // Autofit algorithm — find max n
  function computeAutofit(){
    const S = toNum(els.L_edges.value);
    const w = (els.el_type.value==='rope')?0:toNum(els.w.value);
    const s = toNum(els.s.value);
    const a_min = toNum(els.a_min.value);
    const a_max = toNum(els.a_max.value);
    const g_target = toNum(els.g_target.value);

    // reasonable upper bound for n: if rope (w=0) then floor((S - 2*a_min)/g_target)+1
    const upper = Math.max(1, Math.floor((S - 2*a_min) / Math.max(1,g_target)) + 1);

    for(let n = upper; n>=1; n--){
      if(n===1){
        const a = (S - w)/2;
        if(a>=a_min && a<=a_max) return {n,g:0,a};
        continue;
      }
      // compute a corresponding to g_target
      const a_for_gtarget = (S - n*w - (n-1)*g_target)/2;
      if(a_for_gtarget < a_min) continue; // cannot decrease g to fix (would reduce a)
      if(a_for_gtarget <= a_max){
        // g_target works
        return {n,g:g_target,a:Math.max(a_min, Math.round(a_for_gtarget))};
      }
      // a_for_gtarget > a_max -> can increase g to reduce a
      const g_adjusted = (S - n*w - 2*a_max)/(n-1);
      if(g_adjusted >= g_target){
        return {n,g:Math.round(g_adjusted),a:a_max};
      }
    }
    return {n:0,g:0,a:0};
  }

  // Draw function — renders svg using mm->px scale
  function drawLayout(params){
    // params: S, D_left, D_right, type, w,s, n, g, a, totalSpan
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    const viewW = 1100; const viewH = 400;
    svg.setAttribute('viewBox', `0 0 ${viewW} ${viewH}`);

    const margin = 60;
    const Dl = params.D_left, Dr = params.D_right;
    const totalSpan = params.totalSpan; // Dl + S + Dr
    const scale = (viewW - margin*2) / (totalSpan);
    const yCenter = viewH/2;

    // inner edges (flat faces) positions
    const leftInnerX = margin + Dl*scale;
    const rightInnerX = leftInnerX + params.S*scale;

    // Draw ruler line from inner left edge to inner right edge
    const rulerY = yCenter + 120;
    const ruler = make('line',{x1:leftInnerX,y1:rulerY,x2:rightInnerX,y2:rulerY,stroke:'#333','stroke-width':2});
    svg.appendChild(ruler);

    // ticks and labels — rotated vertically to avoid overlap
    function addTick(x, label, placeAbove=true){
      const tickLen = 10;
      const tline = make('line',{x1:x,y1:rulerY,x2:x,y2:rulerY + (placeAbove?-tickLen:tickLen),class:'tick'});
      svg.appendChild(tline);
      // position text away from ruler: above -> higher, below -> lower
      const yText = placeAbove ? (rulerY - 20) : (rulerY + 28);
      const txt = make('text',{x:x,y:yText,'font-size':12,'text-anchor':'middle',class:'label'});
      txt.textContent = label;
      // rotate text -90 degrees to be vertical, pivot at the text position
      txt.setAttribute('transform', `rotate(-90 ${x} ${yText})`);
      svg.appendChild(txt);
    }

    // platform semicircles: compute centers at far-left and far-right
    const leftCenterX = margin + (Dl/2)*scale;
    const rightCenterX = margin + (Dl + params.S + Dr/2)*scale;
    const radiusL = (Dl/2)*scale; const radiusR = (Dr/2)*scale;
    const leftPath = semicirclePath(leftCenterX,yCenter,radiusL,'right');
    svg.appendChild(make('path',{d:leftPath,fill:'#cfe2ff',stroke:'#2563eb','stroke-width':2,class:'platform'}));
    const rightPath = semicirclePath(rightCenterX,yCenter,radiusR,'left');
    svg.appendChild(make('path',{d:rightPath,fill:'#cfe2ff',stroke:'#2563eb','stroke-width':2,class:'platform'}));

    // draw elements
    const n = params.n;
    const w = params.w; const s = params.s; const g = params.g; const a = params.a;
    let xPos = leftInnerX + a*scale; // leftmost element left edge
    // place elements so their centers line up with semicircle centers
    const elementY = yCenter;
    const boardHeight = 24;
    const hangHeight = 60;

    for(let i=0;i<n;i++){
      if(params.type==='rope'){
        const cx = xPos;
        svg.appendChild(make('circle',{cx:cx,cy:elementY,r:6,fill:'#2b6b6b'}));
        addTick(cx, Math.round(((cx-leftInnerX)/scale)), true);
        xPos += g*scale;
      } else if(params.type==='board'){
        const bw = w*scale;
        const rectY = elementY - boardHeight/2;
        svg.appendChild(make('rect',{x:xPos,y:rectY,width:bw,height:boardHeight,rx:4,fill:'#ffd580',stroke:'#b36b00'}));
        const cx = xPos + bw/2;
        addTick(cx, Math.round(((cx-leftInnerX)/scale)), false);
        xPos += bw + g*scale;
      } else if(params.type==='board_rope'){
        const bw = w*scale;
        const rectY = elementY - boardHeight/2;
        const leftHang = xPos + s*scale;
        const rightHang = xPos + (w - s)*scale;
        svg.appendChild(make('rect',{x:xPos,y:rectY,width:bw,height:boardHeight,rx:4,fill:'#ffd580',stroke:'#b36b00'}));
        // explicit stroke attributes on hang lines to ensure visible in exported SVG
        svg.appendChild(make('line',{x1:leftHang,y1:elementY - hangHeight,x2:leftHang,y2:rectY,class:'hang',stroke:'#b36b00','stroke-width':3}));
        svg.appendChild(make('line',{x1:rightHang,y1:elementY - hangHeight,x2:rightHang,y2:rectY,class:'hang',stroke:'#b36b00','stroke-width':3}));
        svg.appendChild(make('circle',{cx:leftHang,cy:elementY - hangHeight,r:4,fill:'#b36b00'}));
        svg.appendChild(make('circle',{cx:rightHang,cy:elementY - hangHeight,r:4,fill:'#b36b00'}));
        // for board_rope: hangs above, board edge (left edge) below
        addTick(leftHang, Math.round(((leftHang-leftInnerX)/scale)), true);
        addTick(rightHang, Math.round(((rightHang-leftInnerX)/scale)), true);
        addTick(xPos, Math.round(((xPos-leftInnerX)/scale)), false);
        xPos += bw + g*scale;
      }
    }

    // add 0 and final label at inner edges
    addTick(leftInnerX, '0', true);
    addTick(rightInnerX, String(Math.round(params.S)), true);

    // NOTE: informational panel removed from SVG to avoid covering elements.
    // All key values are shown in the HTML results panel below the SVG.
  }

  // small helpers
  function make(tag,attrs){
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for(const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  function semicirclePath(cx,cy,r,direction){
    if(r<=0) return '';
    if(direction==='right'){
      const x1 = cx; const y1 = cy - r;
      const x2 = cx; const y2 = cy + r;
      return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} L ${cx} ${cy + r} L ${cx} ${cy - r} Z`;
    } else {
      const x1 = cx; const y1 = cy - r;
      const x2 = cx; const y2 = cy + r;
      return `M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2} L ${cx} ${cy + r} L ${cx} ${cy - r} Z`;
    }
  }

  // gather parameters and call compute/draw
  function updateAndDraw(useManualN=false){
    const D_left = toNum(els.D_left.value);
    const D_right = toNum(els.D_right.value);
    const S = toNum(els.L_edges.value);
    const type = els.el_type.value;
    const w = (type==='rope')?0:toNum(els.w.value);
    const s = toNum(els.s.value);
    const g_target = toNum(els.g_target.value);
    const a_min = toNum(els.a_min.value);
    const a_max = toNum(els.a_max.value);

    let result = computeAutofit();
    if(useManualN){
      const nManual = Math.max(1,toNum(els.n_manual.value));
      // recompute a and g for given nManual
      if(nManual===1){
        const a = (S - w)/2; result = {n:nManual,g:0,a:Math.round(a)};
      } else {
        const a_try = (S - nManual*w - (nManual-1)*g_target)/2;
        if(a_try>=a_min && a_try<=a_max){
          result = {n:nManual,g:g_target,a:Math.round(a_try)};
        } else {
          // try adjust g to fit a_max
          const g_adj = (S - nManual*w - 2*a_max)/(nManual-1);
          if(g_adj>=g_target){ result = {n:nManual,g:Math.round(g_adj),a:a_max}; }
          else { /* invalid manual n, keep autofit */ }
        }
      }
    }

    // totalSpan for drawing: full platform diameters + edge span
    const totalSpan = S + D_left + D_right;
    const params = Object.assign({}, result, {D_left,D_right,S,type,w,s,g:result.g,a:result.a,totalSpan});

    // update results panel
    renderResults(params);
    drawLayout(params);
  }

  // show/hide s input only for board_rope
  function toggleSField(){
    const wrap = document.getElementById('s_wrap');
    if(els.el_type.value === 'board_rope') wrap.classList.remove('hidden');
    else wrap.classList.add('hidden');
  }

  function renderResults(p){
    results.innerHTML = '';
    const rows = [];
    rows.push({k:'n',v:p.n});
    rows.push({k:'g, мм',v:p.g});
    rows.push({k:'a, мм',v:p.a});
    rows.push({k:'Диам. L/R, мм',v:`${p.D_left} / ${p.D_right}`});
    if(p.type === 'board_rope'){
      rows.push({k:'s, мм', v: p.s});
      rows.push({k:'межд подв, мм', v: Math.max(0, p.w - 2*p.s)});
      if(p.n>1) rows.push({k:'межд подв сосед., мм', v: p.g + (p.w - 2*p.s)});
    }
    rows.forEach(r=>{
      const d = document.createElement('div'); d.className='result-row';
      const k = document.createElement('div'); k.textContent=r.k;
      const v = document.createElement('div'); v.textContent=r.v;
      d.appendChild(k); d.appendChild(v); results.appendChild(d);
    });
  }

  // events
  autofitBtn.addEventListener('click',()=>{ updateAndDraw(false); els.n_manual.value = computeAutofit().n; });
  incN.addEventListener('click',()=>{ els.n_manual.value = Math.max(1,Number(els.n_manual.value||0)+1); updateAndDraw(true); });
  decN.addEventListener('click',()=>{ els.n_manual.value = Math.max(1,Number(els.n_manual.value||0)-1); updateAndDraw(true); });
  $('n_manual').addEventListener('change',()=>updateAndDraw(true));

  printBtn.addEventListener('click', ()=>window.print());
  exportBtn.addEventListener('click', ()=>{
    // clone SVG and embed minimal styles so exported SVG visually matches on-screen
    const clone = svg.cloneNode(true);
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg','style');
    styleEl.textContent = `
      .tick{stroke:#333;stroke-width:1}
      .label{font-size:12px;fill:#111}
      .platform{fill:#cfe2ff;stroke:#2563eb;stroke-width:2}
      .board{fill:#ffd580;stroke:#b36b00}
      .rope{fill:#2b6b6b}
      .hang{stroke:#b36b00;stroke-width:3}
    `;
    clone.insertBefore(styleEl, clone.firstChild);
    const serializer = new XMLSerializer();
    const str = serializer.serializeToString(clone);
    const blob = new Blob([str],{type:'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='scheme.svg'; a.click(); URL.revokeObjectURL(url);
  });

  // wire inputs to re-draw on change
  document.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>updateAndDraw(false)));
  // also handle change events (useful for selects)
  document.querySelectorAll('select').forEach(el=>el.addEventListener('change',()=>{ syncEdgesFromAxes(); updateAndDraw(false); }));
  document.getElementById('el_type').addEventListener('change',()=>{ toggleSField(); updateAndDraw(false); });

  // on load autofit
  window.addEventListener('load',()=>{
    syncEdgesFromAxes();
    // Apply test scenario values requested by user to validate layout
    try{
      els.D_left.value = '1500';
      els.D_right.value = '1500';
      els.el_type.value = 'board_rope';
      els.w.value = '1200';
      els.s.value = '20';
      els.a_min.value = '150';
      els.a_max.value = '200';
      els.n_manual.value = '6';
      els.g_target.value = '600';
      // compute L_edges for these parameters: S = 2*a + n*w + (n-1)*g
      const a = 150; const n = 6; const w = 1200; const g = 600;
      const S = 2*a + n*w + (n-1)*g;
      els.L_edges.value = String(S);
      syncAxesFromEdges();
    } catch(e){/* ignore if elements missing */}
    toggleSField();
    updateAndDraw(true);
  });

})();
