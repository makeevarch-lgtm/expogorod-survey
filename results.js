'use strict';
(() => {
  const byId = (id) => document.getElementById(id);
  const status = byId('results-status');
  if (!status) return;
  const svgNS = 'http://www.w3.org/2000/svg';
  const palette = Object.fromEntries(['technique','science','events','workshops','sport','park','study'].map((id, i) => [id, window.EXPO_CHARTS.colors[i]]));
  const integer = (n) => Number.isInteger(n) && n >= 0;
  const formsWord = (n) => n%10===1 && n%100!==11 ? 'анкета' : n%10>=2 && n%10<=4 && (n%100<12 || n%100>14) ? 'анкеты' : 'анкет';
  const number = (n) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits:1 }).format(n);
  const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
  const svg = (tag, attrs = {}, text) => { const el = document.createElementNS(svgNS, tag); for (const [key,value] of Object.entries(attrs)) el.setAttribute(key, value); if (text !== undefined) el.textContent = text; return el; };
  const testMode=window.EXPO_TEST_MODE===true;
  const isTest=data=>data?.datasetType==='synthetic-demo';
  let dataset;
  let selectedInterest = null;
  let networkMode = 'all';
  const modeNames = { all:'Все связи', frequent:'Частые', leaders:'Лидеры' };
  function setNetworkMode(mode) {
    if (!dataset || !Object.hasOwn(modeNames, mode)) return;
    networkMode = mode;
    byId('network-threshold').value = String(window.EXPO_CHARTS.networkThreshold(dataset.network, mode));
    renderGraph();
  }
  function validate(data) {
    if (data?.schemaVersion !== 1 || !integer(data.totalResponses) || !Number.isFinite(Date.parse(data.sourceAsOf)) || !Number.isFinite(Date.parse(data.generatedAt))) throw new Error('Invalid snapshot');
    if(isTest(data)&&(!testMode||data.method?.refresh!=='synthetic-demo'||!data.demo?.notice))throw new Error('Invalid test snapshot');
    if(testMode&&!isTest(data))throw new Error('Expected test data');
    const { interested, network } = data;
    if (!interested || !integer(interested.base) || !integer(interested.count) || interested.base > data.totalResponses || interested.count > interested.base || !(interested.percent === null && interested.base === 0 || typeof interested.percent === 'number' && Number.isFinite(interested.percent) && interested.percent >= 0 && interested.percent <= 100 && interested.base > 0)) throw new Error('Invalid indicator');
    if (interested.base && Math.abs(interested.percent - 100 * interested.count / interested.base) > 0.050000001) throw new Error('Inconsistent percentage');
    if (!network || !integer(network.base) || network.base > data.totalResponses || !Array.isArray(network.nodes) || network.nodes.length !== 7 || !Array.isArray(network.edges)) throw new Error('Invalid network');
    const ids = new Set(); const counts = new Map();
    for (const item of network.nodes) {
      if (!Object.hasOwn(palette, item.id) || ids.has(item.id) || typeof item.label !== 'string' || !item.label.trim() || item.label.length > 200 || !integer(item.count) || item.count > network.base) throw new Error('Invalid node');
      ids.add(item.id); counts.set(item.id, item.count);
    }
    const pairs = new Set();
    for (const edge of network.edges) {
      const pair = [edge.source,edge.target].sort().join('|');
      if (!ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target || pairs.has(pair) || !integer(edge.count) || edge.count < 1 || edge.count > Math.min(counts.get(edge.source), counts.get(edge.target)) || typeof edge.jaccard !== 'number' || !Number.isFinite(edge.jaccard) || edge.jaccard <= 0 || edge.jaccard > 1) throw new Error('Invalid edge');
      if (Math.abs(edge.jaccard - edge.count / (counts.get(edge.source) + counts.get(edge.target) - edge.count)) > 0.000050001) throw new Error('Inconsistent Jaccard');
      pairs.add(pair);
    }
    window.EXPO_CHARTS?.validateMobility(data.mobility, data.totalResponses);
    return data;
  }
  function chooseInterest(id) {
    if (!dataset) return;
    selectedInterest = selectedInterest === id ? null : id;
    const focusId = document.activeElement?.id;
    renderGraph();
    if (focusId?.startsWith('graph-node-')) byId(focusId)?.focus();
  }
  function renderGraph() {
    const { network } = dataset;
    const minimum = Number(byId('network-threshold').value);
    const edges = network.edges.filter((edge) => edge.count >= minimum);
    const shown = window.EXPO_CHARTS.focusedEdges(network, minimum, selectedInterest);
    const filterLabel = byId('network-filter-label');
    if (filterLabel) filterLabel.textContent = `${number(shown.length)} из ${number(network.edges.length)} связей`;
    document.querySelectorAll('[data-network-mode]').forEach(button => {
      button.setAttribute('aria-pressed', button.dataset.networkMode === networkMode);
      button.disabled = !network.edges.length;
    });
    const description = byId('network-mode-description');
    if (description) description.textContent = networkMode === 'all' ? 'Линия соединяет два интереса, выбранных вместе. Толще линия — чаще сочетание.' : networkMode === 'frequent' ? 'Сочетания, которые выбирают вместе чаще остальных.' : 'Самые частые сочетания интересов.';
    const neighbors = new Set(selectedInterest ? [selectedInterest, ...shown.flatMap((edge) => [edge.source, edge.target])] : networkMode === 'all' ? network.nodes.map((item) => item.id) : edges.flatMap(edge => [edge.source, edge.target]));
    const canvas = byId('network-svg');
    canvas.replaceChildren(svg('title', {id:'network-svg-title'}, 'Связи между поводами приехать'), svg('desc', {id:'network-svg-desc'}, `Ответов на вопрос: ${network.base}. Связей при выбранном пороге: ${shown.length}. Минимум совместных выборов: ${minimum}. Нажмите круг или название интереса, чтобы выделить его связи. Точные числа указаны в списке.`));
    const defs = svg('defs');
    const glow = svg('filter', {id:'network-glow', x:'-100%',y:'-100%',width:'300%',height:'300%'}); glow.append(svg('feGaussianBlur',{stdDeviation:10})); defs.append(glow); canvas.append(defs);
    canvas.append(svg('ellipse',{cx:240,cy:200,rx:170,ry:144,fill:'none',stroke:'#999','stroke-width':1,'stroke-dasharray':'3 6'}));
    canvas.append(svg('path',{d:'M15 25h20m-10-10v20M445 375h20m-10-10v20',stroke:'#171717','stroke-width':1}));
    const hasSelections = network.nodes.some((item) => item.count > 0);
    byId('network-empty').hidden = hasSelections;
    if (!hasSelections) {
      byId('network-empty').querySelector('strong').textContent = dataset.totalResponses ? 'Пока нет выбранных интересов' : 'Схема появится вместе с ответами';
      byId('network-empty').querySelector('p').textContent = dataset.totalResponses ? 'В этом срезе участники ещё не выбрали конкретные поводы приехать.' : 'Каждый интерес станет узлом. Совместный выбор — связью.';
    }
    const points = new Map(network.nodes.map((item,i) => { const angle = -Math.PI/2 + i * 2*Math.PI/network.nodes.length; return [item.id,{x:240+156*Math.cos(angle),y:200+133*Math.sin(angle)}]; }));
    if (hasSelections) {
      const maxEdge = Math.max(1,...edges.map((edge) => edge.count));
      const leadingPairs = edges.slice().sort((a,b) => b.count-a.count || b.jaccard-a.jaccard).slice(0,3);
      const leadingKeys = new Set(leadingPairs.map(edge => [edge.source,edge.target].sort().join('|')));
      for (const edge of edges) {
        const a = points.get(edge.source); const b = points.get(edge.target);
        const relevant = !selectedInterest || edge.source === selectedInterest || edge.target === selectedInterest;
        const emphasized = leadingKeys.has([edge.source,edge.target].sort().join('|'));
        const line = svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#6572ce','data-base-opacity':emphasized ? .75 : .31,'stroke-opacity':selectedInterest ? relevant ? .82 : .07 : emphasized ? .75 : .31,'stroke-width':1.5+5*edge.count/maxEdge, class:`graph-edge${relevant ? ' is-relevant' : ''}`});
        const labels = network.nodes.filter((item) => [edge.source,edge.target].includes(item.id)).map((item) => item.label);
        line.append(svg('title',{},`${labels.join(' + ')}. Совместных выборов: ${edge.count}; Жаккар ${number(edge.jaccard*100)}%.`)); canvas.append(line);
      }
      // Only three counts sit on the drawing; the complete values remain in the list.
      leadingPairs.forEach((edge, index) => {
        const a = points.get(edge.source); const b = points.get(edge.target);
        const x = (a.x+b.x)/2; const y = (a.y+b.y)/2;
        const relevant = !selectedInterest || edge.source===selectedInterest || edge.target===selectedInterest;
        const label = svg('g',{class:'pair-value',opacity:relevant?1:0,'pointer-events':'none','aria-hidden':'true'});
        if (!index) label.append(svg('rect',{x:x-34,y:y-9,width:68,height:18,rx:3,fill:'#fff','fill-opacity':.96,stroke:'#babdcf','stroke-width':.7}));
        label.append(svg('text',{x,y:y+3.5,'font-size':12,'font-family':'Helvetica Neue, Helvetica, Arial, sans-serif','font-weight':700,'text-anchor':'middle',fill:'#4d526b',...index?{stroke:'#fff','stroke-width':5,'paint-order':'stroke','stroke-linejoin':'round'}:{}},index?number(edge.count):`${number(edge.count)} вместе`));
        canvas.append(label);
      });
      const max = Math.max(1,...network.nodes.map((item) => item.count));
      network.nodes.forEach((item,i) => {
        const {x,y} = points.get(item.id); const radius = item.count ? 17+16*Math.sqrt(item.count/max) : 13;
        const relevant = neighbors.has(item.id);

        const group = svg('g',{id:`graph-node-${item.id}`,role:'button',tabindex:0,transform:`translate(${x} ${y})`,style:`--node-color:${palette[item.id]};--node-delay:${-i*.85}s`,'aria-label':`${item.label}. Выборов: ${item.count}. Показать связи`,'aria-pressed':selectedInterest===item.id,class:`graph-node${selectedInterest===item.id ? ' is-selected' : ''}${relevant ? '' : ' is-muted'}${item.count ? '' : ' is-empty'}`});
        group.addEventListener('click',()=>chooseInterest(item.id));
        group.addEventListener('keydown',(event)=>{if(event.key==='Enter' || event.key===' '){event.preventDefault();chooseInterest(item.id);}if(event.key==='Escape'){selectedInterest=null;renderGraph();byId(`graph-node-${item.id}`)?.focus();}});
        group.append(svg('title',{},`${i+1}. ${item.label}. Выборов: ${item.count}.`));
        if (item.count) group.append(svg('circle',{class:'graph-node-halo',cx:0,cy:0,r:radius+8,fill:palette[item.id],filter:'url(#network-glow)',opacity:.38,'aria-hidden':'true','pointer-events':'none'}),svg('circle',{class:'graph-node-wave',cx:0,cy:0,r:radius+3,fill:'none',stroke:palette[item.id],'stroke-width':1.2,opacity:0,'aria-hidden':'true','pointer-events':'none'}));
        if (item.count && network.base) {
          const arcRadius=radius+3.6; const circumference=2*Math.PI*arcRadius;
          group.append(svg('circle',{class:'node-share-track',cx:0,cy:0,r:arcRadius,fill:'none',stroke:palette[item.id],'stroke-opacity':.25,'stroke-width':.7,'aria-hidden':'true'}),svg('circle',{class:'node-share-arc',cx:0,cy:0,r:arcRadius,fill:'none',stroke:palette[item.id],'stroke-width':1.8,'stroke-dasharray':`${circumference*item.count/network.base} ${circumference}`,transform:'rotate(-90)','stroke-linecap':'round','aria-label':`${item.count} из ${network.base}`}));
        }
        group.append(svg('circle',{class:'graph-node-disc',cx:0,cy:0,r:radius,fill:item.count?palette[item.id]:'#f5f5f5','fill-opacity':1,stroke:'#171717','stroke-width':1.8}),svg('text',{class:'graph-node-label',x:0,y:6,'text-anchor':'middle','font-size':item.count?19:14,'font-family':'Helvetica Neue, Helvetica, Arial, sans-serif',fill:'#171717'},String(i+1).padStart(2,'0'))); canvas.append(group);
      });
    }
    byId('network-reset').disabled = !selectedInterest;
    document.querySelectorAll('.network-choice').forEach((button)=>{const active=button.dataset.interest===selectedInterest;button.setAttribute('aria-pressed',active);button.classList.toggle('is-selected',active);});
    const selected = network.nodes.find((item)=>item.id===selectedInterest);
    byId('network-selected').textContent = selected ? `${selected.label}: ${selected.count} из ${network.base} ответов. Показано сочетаний: ${shown.length}.` : 'Нажмите на круг или название, чтобы увидеть его сочетания.';
    const connections = byId('network-connections'); connections.replaceChildren();
    if(selected) {
      const labels = new Map(network.nodes.map((item)=>[item.id,item.label]));
      shown.slice().sort((a,b)=>b.count-a.count).forEach((edge)=>{const row=node('li');row.append(node('span',labels.get(edge.source===selected.id?edge.target:edge.source)),node('strong',`${edge.count} из ${network.base} вместе`));connections.append(row);});
      if(!shown.length) { const row=node('li','В этом режиме сочетаний нет. ');const all=node('button','Показать все','network-show-all');all.type='button';all.addEventListener('click',()=>setNetworkMode('all'));row.append(all);connections.append(row); }
    }
    const tableMount = byId('network-table'); tableMount.replaceChildren();
    if (!edges.length) { tableMount.append(node('p',hasSelections ? 'При выбранном пороге совместных выборов пока нет. Отдельные интересы остаются видны на схеме.' : 'Связей для сравнения пока нет.')); window.EXPO_MOTION?.refresh(canvas); return; }
    const table = node('table'); const caption = node('caption',`Совместные выборы · минимум ${minimum}`); caption.className='sr-only'; table.append(caption);
    const header = node('tr'); for (const text of ['Пара интересов','Вместе','Жаккар']) { const th=node('th',text);th.scope='col';header.append(th); } const head=node('thead');head.append(header);table.append(head);
    const body=node('tbody'); const labels=new Map(network.nodes.map((item)=>[item.id,item.label]));
    edges.sort((a,b)=>b.count-a.count || b.jaccard-a.jaccard).forEach((edge)=>{const row=node('tr'); row.append(node('td',`${labels.get(edge.source)} + ${labels.get(edge.target)}`),node('td',number(edge.count)),node('td',`${number(edge.jaccard*100)}%`));body.append(row);});
    table.append(body);tableMount.append(table);
    window.EXPO_MOTION?.refresh(canvas);
  }
  function render(data) {
    dataset=data;
    if(testMode){byId('network-threshold').value='1';if(byId('metric-total-label'))byId('metric-total-label').textContent='Тестовых ответов';}
    byId('metric-total').textContent=number(data.totalResponses);
    byId('metric-interest').textContent=data.interested.percent===null?'—':data.interested.base<10?`${number(data.interested.count)} из ${number(data.interested.base)}`:`${number(data.interested.percent)} %`;
    byId('metric-interest-note').textContent=data.interested.base?`«Определённо» или «скорее посетил(а) бы»: ${number(data.interested.percent)}% (${number(data.interested.count)} из ${number(data.interested.base)}).${data.interested.base<10 ? ' Пока слишком мало анкет для общих выводов.' : ''}`:'Пока нет ответов на вопрос о желании приехать.';
    byId('metric-pairs').textContent=number(data.network.edges.length);
    const date=new Intl.DateTimeFormat('ru-RU',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(data.sourceAsOf));
    status.textContent=testMode?`Тестовый набор · ${number(data.totalResponses)} ответа`:`${data.totalResponses ? `${number(data.totalResponses)} ${formsWord(data.totalResponses)}` : 'Сбор начинается'} · обновлено ${date} МСК.`;
    byId('network-base').textContent=`Основание: ${number(data.network.base)} ответов`;
    const list=byId('network-nodes');list.replaceChildren();
    data.network.nodes.forEach((item,i)=>{const row=node('li');const button=node('button',undefined,'network-choice');button.type='button';button.dataset.interest=item.id;button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>chooseInterest(item.id));button.addEventListener('keydown',(event)=>{if(event.key==='Escape'){selectedInterest=null;renderGraph();}});const key=node('span',String(i+1).padStart(2,'0'),'node-key');key.style.background=palette[item.id];const count=node('strong',data.network.base?number(item.count):'—','node-count');count.setAttribute('aria-label',data.network.base?`Выборов: ${item.count}`:'Нет данных');button.append(key,node('span',item.label),count);row.append(button);list.append(row);});
    const caption=document.querySelector('.network-caption');
    if(caption) caption.replaceChildren(node('span','Круг — число выборов'),node('span','Дуга — доля ответов'),node('span','Линия — совместный выбор'),node('span','Цвета — как в списке интересов','caption-note'));
    const q=data.quality || {};
    const before=integer(q.beforeSelectionChange)?q.beforeSelectionChange:0;

    const invalid=integer(q.networkInvalid)?q.networkInvalid:0; const missing=integer(q.networkMissing)?q.networkMissing:0;
    byId('quality-note').textContent=`Ответов в основании графа: ${number(data.network.base)}, включая отдельные ответы «Ничего из перечисленного» и «Трудно сказать». Они не создают узлов или связей. Пропущено: ${number(missing)}; исключено из графа из-за несовместимых или нераспознанных вариантов: ${number(invalid)}. Известные тестовые отправки исключены из всех показателей.${before ? ` До отмены ограничений на число выбранных вариантов получено анкет: ${number(before)}. Эти ответы сохранены в срезе; сравнивать их с новыми нужно с учётом изменения анкеты.` : ''}`;
    byId('network-threshold').disabled=!data.network.edges.length;
    download.disabled=!data.network.nodes.some((item)=>item.count>0);
    renderGraph();
    window.EXPO_CHARTS?.render(data);
    if(testMode){
      byId('network-base').textContent=`${number(data.network.base)} тестовых ответа · несколько вариантов`;
      byId('quality-note').textContent=data.demo.notice+' '+data.demo.assumptions;
      if(byId('insights-title'))byId('insights-title').textContent='Структура интересов';
      if(byId('project-hypothesis'))byId('project-hypothesis').textContent='Сочетания функций в тестовом наборе: выставки, познание, прогулки и профессиональные встречи.';
      download.textContent='Скачать тестовую схему SVG ↓';
    }
    window.EXPO_MOTION?.refresh();
  }
  const download = node('button','Скачать схему SVG ↓','primary graph-download');
  download.type='button'; download.disabled=true; download.style.marginTop='16px';
  download.title='Векторная схема с подписями, датой среза и основанием';
  document.querySelector('.network-key').append(download);
  download.addEventListener('click',()=>{
    if(!dataset || download.disabled) return;
    const exported=svg('svg',{'data-dataset-kind':testMode?'synthetic-demo':'survey',xmlns:svgNS,viewBox:'0 0 480 820',width:960,height:1640,role:'img'});
    exported.append(svg('title',{},testMode?'Экспогород — тестовый набор связей интересов':'Экспогород — связи между интересами'),svg('rect',{width:480,height:820,fill:'#ffffff'}));
    const text=(x,y,value,size=12,weight=400)=>svg('text',{x,y,'font-size':size,'font-weight':weight,'font-family':'Helvetica Neue, Helvetica, Arial, sans-serif',fill:'#171717'},value);
    const date=new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(dataset.sourceAsOf));
    exported.append(text(20,30,testMode?'ТЕСТ / СВЯЗИ ИНТЕРЕСОВ':'ЭКСПОГОРОД / СВЯЗИ ИНТЕРЕСОВ',19,700),text(20,51,testMode?`Тестовый набор: ${dataset.network.base} ответа`:`Срез: ${date} МСК · ответов: ${dataset.network.base}`),text(20,69,`Режим: ${modeNames[networkMode]} · минимум совместных выборов: ${byId('network-threshold').value}`));
    const graph=byId('network-svg').cloneNode(true);graph.setAttribute('x',0);graph.setAttribute('y',83);graph.setAttribute('width',480);graph.setAttribute('height',400);graph.setAttribute('role','img');
    // Export the complete graph at the active threshold, independent of UI focus.
    graph.querySelectorAll('.graph-node-halo, .graph-node-wave').forEach(item=>item.remove());
    graph.querySelectorAll('.graph-edge').forEach((edge)=>edge.setAttribute('stroke-opacity',edge.getAttribute('data-base-opacity')));
    graph.querySelectorAll('.pair-value').forEach((item)=>item.setAttribute('opacity',1));
    graph.querySelectorAll('.graph-node').forEach((item)=>{item.removeAttribute('class');item.removeAttribute('tabindex');item.removeAttribute('role');item.removeAttribute('aria-pressed');});
    graph.querySelector('desc').textContent=`Ответов: ${dataset.network.base}. Порог совместного выбора: ${byId('network-threshold').value}. Числа и названия интересов приведены ниже.`;exported.append(graph);
    let y=506;
    dataset.network.nodes.forEach((item,i)=>{
      exported.append(svg('rect',{x:20,y:y-14,width:24,height:24,fill:palette[item.id],'fill-opacity':1,stroke:'#171717','stroke-width':1.5}),text(24,y+2,String(i+1).padStart(2,'0'),11,700));
      const words=item.label.split(' ');let line='';const lines=[];
      words.forEach((word)=>{if((line+' '+word).trim().length>49){lines.push(line);line=word;}else line=(line+' '+word).trim();});if(line)lines.push(line);
      lines.forEach((line,k)=>exported.append(text(54,y+k*14,line,12)));
      exported.append(text(438,y,String(item.count),13,700));y+=Math.max(30,lines.length*14+5);
    });
    exported.append(text(20,752,'Круг — число выборов; дуга — доля; линия — выбор вместе.',11),text(20,769,testMode?'Тестовый набор для демонстрации интерфейса.':'Предварительный срез добровольного опроса, не потоки людей.',10));
    if(dataset.quality?.beforeSelectionChange) exported.append(text(20,786,`Анкет до отмены лимитов выбора: ${dataset.quality.beforeSelectionChange}.`,10));
    const blob=new Blob([new XMLSerializer().serializeToString(exported)],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(blob);const link=node('a');link.href=url;link.download=testMode?`expogorod-test-${dataset.network.base}-network.svg`:`expogorod-network-${dataset.sourceAsOf.slice(0,10)}.svg`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  });
  document.querySelectorAll('[data-network-mode]').forEach(button=>button.addEventListener('click',()=>setNetworkMode(button.dataset.networkMode)));
  byId('network-threshold').addEventListener('change',()=>{if(dataset)renderGraph();});
  byId('network-reset').addEventListener('click',()=>{selectedInterest=null;if(dataset)renderGraph();});
  fetch(testMode?'results-demo.json':'results.json',{cache:'no-store'}).then((response)=>{if(!response.ok)throw new Error('Unavailable snapshot');return response.json();}).then(validate).then(render).catch(()=>{
    document.querySelectorAll('.chart-panel > div').forEach((el)=>{el.textContent='Проверенный срез недоступен. Диаграмма появится после загрузки данных.';});
    status.textContent='Срез результатов сейчас недоступен. Анкета продолжает работать; показатели появятся после проверки данных.';
    byId('network-svg-desc').textContent='Данные результатов недоступны.';
    byId('network-empty').querySelector('strong').textContent='Ожидаем проверенные данные';
    byId('network-empty').querySelector('p').textContent='Пока срез недоступен, числа и связи не отображаются.';
    byId('network-base').textContent='Срез не загружен';
  });
})();
