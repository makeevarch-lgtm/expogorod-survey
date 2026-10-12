'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const labels = {science:'Наука',exhibition:'Выставки',education:'Образование'};
  const colors = {science:'#bcc6fb',exhibition:'#fe96c1',education:'#c6d875'};
  const el = (tag,text,className) => {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
  const fmt = n => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n);
  let map, catalog, geography, buildings, railContext, center, markers=[], contextMarkers=[], filter='all', selected=null, ready=false, tilted=false, tourStep=0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tour = [
    {title:'Городской контекст', camera:'Обзор Москвы', description:'Научные, выставочные и образовательные функции уже существуют в городе. Выберите метку, чтобы посмотреть, как они сочетаются на одной площадке.', next:'К кольцу →'},
    {title:'Экспериментальное кольцо', camera:'Кольцо и окружение', description:'Три замкнутых железнодорожных пути в Щербинке окружают большую территорию. Здесь исследуется идея Экспогорода — сочетания науки, выставок и городской жизни.', insight:'Синяя заливка показывает пространство внутри внешнего пути, а не границу проектирования. Серые объёмы — существующая застройка, высоты могут быть оценочными.', next:'ВНИИЖТ и МЦД-2 →'},
    {title:'ВНИИЖТ и МЦД-2', camera:'Корпуса ВНИИЖТ · Щербинка · МЦД-2', description:'Здесь видны существующий комплекс ВНИИЖТ, его испытательные и лабораторные корпуса, станция Щербинка и основной железнодорожный ход. Нажмите на подпись, чтобы узнать, что это за объект.', insight:'Синий — Курское направление, по которому проходит МЦД-2. Пунктир — соединительный путь к испытательному кольцу. Выделение комплекса показывает существующее положение; доступность проходов по карте не определяется.', next:'Снова Москва ↺'}
  ];
  function tourCopy(){
    const step=tour[tourStep];
    $('gis-tour-counter').textContent=`Ракурс 0${tourStep+1} / 03`;
    $('gis-tour-title').textContent=step.title;
    $('gis-tour-description').textContent=step.description;
    $('gis-tour-insight').textContent=tourStep===0&&catalog?`${catalog.items.length} выбранных площадок; ${catalog.items.filter(i=>i.functions.length>1).length} совмещают функции. Это исследовательская подборка, а не полный реестр.`:step.insight||'';
    $('gis-tour-next').textContent=step.next;
    $('gis-tour-back').disabled=tourStep===0;
    $('gis-camera-label').textContent=step.camera;
    $('gis-context-legend').hidden=tourStep!==2;
    document.querySelector('.gis-legend:not(#gis-context-legend)').hidden=tourStep===2;
    document.querySelectorAll('[data-tour]').forEach(b=>{if(Number(b.dataset.tour)===tourStep)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  }
  function stationDetail(){
    detail(null);selected='station';
    const target=$('gis-detail');target.hidden=false;target.replaceChildren(el('h3','Станция Щербинка'),el('p','Существующая станция МЦД-2 · Курское направление. Положение — OpenStreetMap, статус D2 — Департамент транспорта Москвы.'),el('p','Станция — ориентир транспортного окружения кольца. Эта карта не показывает подтверждённый пешеходный маршрут от станции внутрь территории.'));
    const a=el('a','Станция в OpenStreetMap ↗');a.href='https://www.openstreetmap.org/node/1990632047';a.target='_blank';a.rel='noopener noreferrer';target.append(a);const official=el('a','Щербинка D2 · Дептранс ↗');official.href='https://transport.mos.ru/mostrans/all_news/123003';official.target='_blank';official.rel='noopener noreferrer';target.append(el('p'),official);
    markers.forEach(m=>m.button.classList.toggle('is-selected',m.id==='station'));updateLabels();
  }
  function setTour(index){
    tourStep=Math.max(0,Math.min(2,index));tourCopy();
    markers.forEach(m=>{if(m.id==='station')m.button.hidden=tourStep!==2;});
    if(!ready)return;
    detail(null);tilted=tourStep!==0;$('gis-3d').setAttribute('aria-pressed',String(tilted));
    const padding=Math.max(30,Math.min(70,$('gis-map').clientWidth*.1));
    const duration=reduced?0:1050;
    if(tourStep===0){
      const bounds=[center,...catalog.items.map(i=>i.coordinates)].reduce((b,p)=>b.extend(p),new maplibregl.LngLatBounds());
      map.fitBounds(bounds,{padding,pitch:0,bearing:0,duration,maxZoom:11});
    }else{
      const b=tourStep===2?railContext.metadata.focus_bbox:geography.metadata.ring_bbox;
      const bounds=new maplibregl.LngLatBounds([b[0],b[1]],[b[2],b[3]]);

      if(tourStep===2){
        map.flyTo({center:[(b[0]+b[2])/2,(b[1]+b[3])/2],zoom:$('gis-map').clientWidth>700?14.65:14.05,pitch:44,bearing:0,duration});
      }else map.fitBounds(bounds,{padding,pitch:50,bearing:-20,duration,maxZoom:15.2});
    }
    map.setPaintProperty('expo-rail-approach','line-width',['interpolate',['linear'],['zoom'],8,tourStep===2?2:1,15,tourStep===2?4:2.8]);
    map.setPaintProperty('expo-rail-approach','line-opacity',tourStep===2?1:.7);
    map.setPaintProperty('expo-rail-approach','line-dasharray',tourStep===2?[2,1.5]:[1,0]);
    ['context-campus-fill','context-campus-edge'].forEach(id=>map.setLayoutProperty(id,'visibility',tourStep===2?'visible':'none'));
    ['context-main-halo','context-main-line'].forEach(id=>map.setLayoutProperty(id,'visibility',tourStep===0?'none':'visible'));
    map.setPaintProperty('expo-ring-area','fill-opacity',tourStep===2?.07:.18);
    contextMarkers.forEach(m=>m.button.hidden=tourStep!==2);
    updateLabels();
  }
  const distance = (a,b) => {const r=Math.PI/180;const dlat=(b[1]-a[1])*r,dlon=(b[0]-a[0])*r;const h=Math.sin(dlat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dlon/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));};
  const isPoint = p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>36&&p[0]<39&&p[1]>54&&p[1]<57;
  function validate(data,geo){
    if(!Array.isArray(data.items)||!data.items.length||!geo.features?.length||!isPoint(geo.metadata?.ring_bbox_center))throw Error('Invalid map dataset');
    const ids=new Set();for(const i of data.items){if(typeof i.id!=='string'||ids.has(i.id)||typeof i.name!=='string'||!isPoint(i.coordinates)||!Array.isArray(i.functions)||!i.functions.length||i.functions.some(f=>!labels[f])||new Set(i.functions).size!==i.functions.length||!/^https:\/\//.test(i.sourceUrl))throw Error('Invalid facility');ids.add(i.id);}
  }
  const visible = () => catalog.items.filter(i=>filter==='all'||filter==='focus'&&Boolean(i.focusReason)||filter==='mixed'&&i.functions.length>1||i.functions.includes(filter));
  function detail(item){
    const target=$('gis-detail');target.replaceChildren();target.hidden=!item;selected=item?.id||null;
    $('gis-reset').hidden=tourStep===0&&!item;
    if(!item){target.append(el('h3','Экспериментальное кольцо'),el('p','Щербинка · территория исследования.'),el('p','На карте выделены три действительных кольцевых пути по данным OpenStreetMap. Тонкой линией показаны ближайший участок магистрали и соединительный путь. Прозрачная заливка выделяет пространство внутри внешнего кольца, а не границу проектирования.'));const a=el('a','О кольце · ВНИИЖТ ↗');a.href='https://www.vniizht.ru/about/scientific-centers-and-branches/experimental-ring/';a.target='_blank';a.rel='noopener noreferrer';target.append(a);}
    else {target.append(el('h3',item.name));if(item.focusReason)target.append(el('p','Опорный пример · '+item.focusReason,'gis-focus-note'));const tags=el('div',undefined,'gis-tags');item.functions.forEach(f=>{const t=el('span',labels[f],'gis-tag');t.style.background=colors[f]+'99';tags.append(t);});target.append(tags,el('p',item.description),el('p',`${fmt(distance(center,item.coordinates))} км от кольца по прямой.`),el('p',item.access||'Условия посещения уточняйте на официальном сайте.'));const a=el('a','Официальный источник ↗');a.href=item.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';target.append(a);}
    markers.forEach(m=>m.button.classList.toggle('is-selected',m.id===selected));updateLabels();
    document.querySelectorAll('.gis-table tr[data-id]').forEach(row=>row.classList.toggle('is-selected',row.dataset.id===selected));
  }
  function focusItem(item){detail(item);if(ready)map.flyTo({center:item.coordinates,zoom:14.5,pitch:tilted?55:0,bearing:tilted?-18:0,duration:reduced?0:1200});$('gis-camera-label').textContent='Выбранная площадка · '+item.name;}
  function table(){const items=visible();$('gis-count').textContent=items.length;$('gis-mixed').textContent=items.filter(i=>i.functions.length>1).length;
    const table=el('table',undefined,'gis-table');table.setAttribute('role','table');table.append(el('caption','Выбранные площадки: функции и расстояние до кольца','sr-only'));
    const head=el('thead'),hr=el('tr');head.setAttribute('role','rowgroup');hr.setAttribute('role','row');
    ['Площадка','Наука','Выставки','Образование','До кольца, км','Источник'].forEach(t=>{const th=el('th',t);th.scope='col';th.setAttribute('role','columnheader');hr.append(th);});head.append(hr);table.append(head);
    const body=el('tbody');body.setAttribute('role','rowgroup');
    items.slice().sort((a,b)=>distance(center,a.coordinates)-distance(center,b.coordinates)).forEach(item=>{
      const row=el('tr');row.dataset.id=item.id;row.setAttribute('role','row');
      const name=el('td',undefined,'gis-table-name'),button=el('button',item.name);name.setAttribute('role','cell');button.type='button';
      button.addEventListener('click',()=>{focusItem(item);$('gis-map').scrollIntoView({behavior:reduced?'auto':'smooth',block:'center'});});
      name.append(button);if(item.focusReason)name.append(el('small','Опорный пример','gis-table-focus'));row.append(name);
      Object.keys(labels).forEach(f=>{
        const cell=el('td',undefined,'gis-table-function');cell.dataset.label=labels[f];cell.setAttribute('role','cell');
        if(item.functions.includes(f)){
          const dot=el('span',undefined,'function-dot');dot.style.background=colors[f]+'bf';dot.setAttribute('aria-label','Подтверждено источником');cell.append(dot,el('span','Есть','gis-function-status'));
        }else{const dash=el('span','—','gis-function-dash');dash.setAttribute('aria-label','Не отмечено в подборке');cell.append(dash,el('span','Не отмечено','gis-function-status'));}
        row.append(cell);
      });
      const distanceCell=el('td',fmt(distance(center,item.coordinates)),'gis-table-distance');distanceCell.dataset.label='До кольца, км';distanceCell.setAttribute('role','cell');row.append(distanceCell);
      const source=el('td',undefined,'gis-table-source'),link=el('a','Сайт ↗');source.dataset.label='Источник';source.setAttribute('role','cell');link.href=item.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';source.append(link);row.append(source);body.append(row);
    });
    table.append(body);$('gis-table').replaceChildren(table);if(!items.length)$('gis-table').append(el('p','В подборке пока нет площадок с такой функцией.'));
    markers.forEach(m=>m.marker.getElement().hidden=m.id==='station'?tourStep!==2:m.id!=='ring'&&!items.some(i=>i.id===m.id));if(selected&&!items.some(i=>i.id===selected))detail(null);updateLabels();
  }
  function view(which){setTour(which==='ring'?1:0);}
  // Label collisions affect captions only; geographic marker positions never move.
  function updateLabels(){
    if(!map)return;
    const bounds=$('gis-map').getBoundingClientRect(),occupied=[];
    markers.forEach(m=>m.button.classList.remove('has-label'));
    contextMarkers.forEach(m=>m.button.classList.remove('has-label','label-below'));
    const ordered=[...markers,...contextMarkers].filter(m=>!m.button.hidden&&(m.id==='ring'||m.id==='station'||m.id===selected||m.focus||m.context))
      .sort((a,b)=>(b.id===selected?10:b.id==='station'?9:b.context?b.priority: b.id==='ring'?2:1)-(a.id===selected?10:a.id==='station'?9:a.context?a.priority: a.id==='ring'?2:1));
    for(const m of ordered){
      const pin=m.button.getBoundingClientRect();
      if(pin.right<bounds.left||pin.left>bounds.right||pin.bottom<bounds.top||pin.top>bounds.bottom)continue;
      m.button.classList.add('has-label');
      const label=m.button.querySelector('.gis-pin-label, .gis-context-label');label.style.marginLeft='0px';
      let r=label.getBoundingClientRect();const shift=Math.max(0,bounds.left+8-r.left)-Math.max(0,r.right-bounds.right+8);
      label.style.marginLeft=shift+'px';r=label.getBoundingClientRect();
      const overlaps=box=>occupied.some(o=>box.left<o.right+8&&box.right>o.left-8&&box.top<o.bottom+8&&box.bottom>o.top-8);
      if(m.context&&overlaps(r)){m.button.classList.add('label-below');r=label.getBoundingClientRect();}
      if(overlaps(r))m.button.classList.remove('has-label');
      else occupied.push(r);
    }
  }
  function marker(point,id,name,functions,focusReason,shortName){
    const button=el('button',undefined,'gis-pin'+(id==='ring'?' gis-pin-ring':id==='station'?' gis-pin-station':focusReason?' gis-pin-focus':''));
    button.type='button';button.setAttribute('aria-label',name);button.title=name;
    button.append(el('span',shortName||name,'gis-pin-label'));
    if(functions?.length){const alpha=focusReason?'bf':'80';const stops=functions.map((f,i)=>`${colors[f]}${alpha} ${i*100/functions.length}% ${(i+1)*100/functions.length}%`);button.style.setProperty('background',`conic-gradient(${stops.join(',')})`,'important');}
    button.addEventListener('click',()=>id==='ring'?view('ring'):id==='station'?stationDetail():focusItem(catalog.items.find(i=>i.id===id)));
    if(id==='station')button.hidden=tourStep!==2;
    const m=new maplibregl.Marker({element:button}).setLngLat(point).addTo(map);markers.push({id,marker:m,button,focus:Boolean(focusReason)});
  }
  function contextMarker(feature){
    const p=feature.properties;
    const button=el('button',undefined,'gis-context-marker '+(p.type||'campus'));
    button.type='button';button.hidden=true;button.setAttribute('aria-label',p.label);button.title=p.label;
    button.append(el('span',p.label,'gis-context-label'));
    button.addEventListener('click',()=>{
      detail(null);selected=String(feature.id);const target=$('gis-detail');target.hidden=false;
      target.replaceChildren(el('h3',p.label),el('p',p.description));
      if(p.source_url){const a=el('a','Источник объекта ↗');a.href=p.source_url;a.target='_blank';a.rel='noopener noreferrer';target.append(a);}
      updateLabels();
    });
    const marker=new maplibregl.Marker({element:button,anchor:'center'}).setLngLat(feature.geometry.coordinates).addTo(map);
    contextMarkers.push({id:String(feature.id),marker,button,context:true,priority:p.priority||4});
  }
  function minimalBasemap(){
    for(const layer of map.getStyle().layers){
      const id=layer.id,source=layer['source-layer'];
      if(layer.type==='background')map.setPaintProperty(id,'background-color','#ffffff');
      if(layer.type==='fill'){
        // Reference board: white ground, pale landscape, solid grey footprints.
        const color=source==='building'?'#bfbfbf':source==='water'?'#d1d1d1':source==='park'||source==='landcover'?'#f4f4f4':'#ffffff';
        map.setPaintProperty(id,'fill-color',color);
        map.setPaintProperty(id,'fill-outline-color',source==='building'?'#bfbfbf':source==='water'?'#c7c7c7':source==='park'||source==='landcover'?'#ededed':'#ffffff');
        if(source==='building'||source==='water')map.setPaintProperty(id,'fill-opacity',1);
      }
      if(layer.type==='line'){
        const railway=id.startsWith('railway'),road=source==='transportation'&&!railway;
        const color=source==='waterway'?'#c7c7c7':source==='boundary'?'#cccccc':railway?(id.includes('dashline')?'#ffffff':'#b2b2b2'):id.includes('inner')?'#ffffff':id.includes('casing')?'#b4b4b4':id==='highway_path'?'#dedede':'#c9c9c9';
        map.setPaintProperty(id,'line-color',color);
        map.setPaintProperty(id,'line-opacity',source==='boundary'?.25:.9);
        if(road&&layer.paint?.['line-width']!==undefined){const raw=layer.paint['line-width'],factor=id==='highway_minor'?.6:.8;const width=typeof raw==='number'?raw*factor:raw[0]==='interpolate'?raw.map((v,i)=>i>=4&&i%2===0&&typeof v==='number'?v*factor:v):raw;map.setPaintProperty(id,'line-width',width);}
        if(id==='highway_path')map.setLayerZoomRange(id,14,24);
        if(source==='aeroway')map.setLayoutProperty(id,'visibility','none');
      }
      if(layer.type==='symbol'){
        const place=source==='place',majorRoad=id==='highway-name-major';
        if(!place&&!majorRoad||/country|state|village/.test(id)){map.setLayoutProperty(id,'visibility','none');continue;}
        map.setLayoutProperty(id,'text-field',['coalesce',['get','name:ru'],['get','name:nonlatin'],['get','name']]);
        map.setPaintProperty(id,'text-color','#777777');map.setPaintProperty(id,'text-halo-color','#ffffff');map.setPaintProperty(id,'text-halo-width',1);
        if(id==='label_town')map.setLayerZoomRange(id,11,24);
        if(id==='label_other'||majorRoad)map.setLayerZoomRange(id,14,24);
      }
    }
  }
  function startMap(){
    if(!window.maplibregl){ $('gis-map-status').textContent='3D-карта недоступна в этом браузере. Подборка, функции и расстояния остаются доступны в таблице ниже.';return;}
    try{map=new maplibregl.Map({container:'gis-map',style:'https://tiles.openfreemap.org/styles/positron',center,zoom:10,pitch:0,bearing:0,maxZoom:18,minZoom:7,maxBounds:[[36.5,55.1],[38.7,56.2]],attributionControl:true,cooperativeGestures:true,canvasContextAttributes:{antialias:true}});}catch(e){$('gis-map-status').textContent='Не удалось запустить карту. Посмотрите сравнение площадок в таблице ниже.';return;}
    map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');map.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-left');
    map.on('error',()=>{if(!ready){$('gis-map-status').hidden=false;$('gis-map-status').textContent='Базовая карта загружается с задержкой. Таблица площадок доступна ниже.';}});
    map.on('load',()=>{
      try {
        const layers=map.getStyle().layers;const symbol=layers.find(l=>l.type==='symbol');
        minimalBasemap();
        map.addSource('expo-ring',{type:'geojson',data:geography});
        map.addLayer({id:'expo-ring-area',type:'fill',source:'expo-ring',filter:['==',['get','kind'],'ring-area'],paint:{'fill-color':'#909bea','fill-opacity':.18}},layers.find(l=>l['source-layer']==='building')?.id||symbol?.id);
        map.addLayer({id:'expo-buildings',type:'fill-extrusion',source:'openmaptiles','source-layer':'building',minzoom:14,filter:['!=',['get','hide_3d'],true],paint:{'fill-extrusion-color':'#c4c4c4','fill-extrusion-height':['coalesce',['get','render_height'],0],'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':.85}},symbol?.id);
        map.addSource('ring-buildings',{type:'geojson',data:buildings});
        map.addLayer({id:'ring-buildings-overview',type:'fill-extrusion',source:'ring-buildings',minzoom:12,maxzoom:14,paint:{'fill-extrusion-color':'#c4c4c4','fill-extrusion-height':['get','height'],'fill-extrusion-base':['get','base'],'fill-extrusion-opacity':.85}},symbol?.id);
        map.addLayer({id:'expo-rail-approach',type:'line',source:'expo-ring',filter:['==',['get','kind'],'rail-approach'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#777ed0','line-width':['interpolate',['linear'],['zoom'],8,1,15,2.8],'line-opacity':.8}});
        map.addSource('rail-context',{type:'geojson',data:railContext});
        const ground=layers.find(l=>l['source-layer']==='building')?.id||symbol?.id;
        map.addLayer({id:'context-campus-fill',type:'fill',source:'rail-context',filter:['==',['get','kind'],'campus-area'],layout:{visibility:'none'},paint:{'fill-color':'#fe96c1','fill-opacity':.16}},ground);
        map.addLayer({id:'context-campus-edge',type:'line',source:'rail-context',filter:['==',['get','kind'],'campus-area'],layout:{visibility:'none','line-join':'round'},paint:{'line-color':'#bb608a','line-width':2,'line-opacity':.8}});
        map.addLayer({id:'context-main-halo',type:'line',source:'rail-context',filter:['==',['get','kind'],'mcd-main'],layout:{visibility:'none','line-cap':'round','line-join':'round'},paint:{'line-color':'#bcc6fb','line-width':12,'line-opacity':.55,'line-blur':3}});
        map.addLayer({id:'context-main-line',type:'line',source:'rail-context',filter:['==',['get','kind'],'mcd-main'],layout:{visibility:'none','line-cap':'round','line-join':'round'},paint:{'line-color':'#414cda','line-width':['interpolate',['linear'],['zoom'],10,2,15,4.5],'line-opacity':.95}});
        railContext.features.filter(f=>f.properties.kind==='context-label').forEach(contextMarker);
        map.addLayer({id:'expo-ring-halo',type:'line',source:'expo-ring',filter:['==',['get','kind'],'ring'],paint:{'line-color':'#bcc6fb','line-width':['interpolate',['linear'],['zoom'],8,6,15,16],'line-opacity':.5,'line-blur':5}});map.addLayer({id:'expo-ring-line',type:'line',source:'expo-ring',filter:['==',['get','kind'],'ring'],paint:{'line-color':'#414cda','line-width':['interpolate',['linear'],['zoom'],8,2,15,3],'line-opacity':.9}});
        marker(center,'ring','Экспериментальное кольцо',null,null,'Кольцо ВНИИЖТ');const station=geography.features.find(f=>f.properties.kind==='station');if(station)marker(station.geometry.coordinates,'station','Существующая станция Щербинка',null,null,'Станция Щербинка');catalog.items.forEach(i=>marker(i.coordinates,i.id,i.name,i.functions,i.focusReason,i.shortName));map.on('moveend',updateLabels);map.on('resize',updateLabels);ready=true;$('gis-map-status').hidden=true;table();setTour(tourStep);
      }catch(e){$('gis-map-status').hidden=false;$('gis-map-status').textContent='Не удалось отобразить все слои карты. Подборка площадок доступна в таблице.';}
    });
    setTimeout(()=>{if(!ready){$('gis-map-status').hidden=false;$('gis-map-status').textContent='Карта пока недоступна. Можно сравнить площадки в таблице или перезагрузить страницу.';}},20000);
  }
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{if(!catalog)return;filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));table();setTour(tourStep);}));
  document.querySelectorAll('[data-tour]').forEach(b=>b.addEventListener('click',()=>setTour(Number(b.dataset.tour))));
  $('gis-tour-next').addEventListener('click',()=>setTour((tourStep+1)%3));
  $('gis-tour-back').addEventListener('click',()=>setTour(tourStep-1));
  $('gis-3d').addEventListener('click',()=>{tilted=!tilted;$('gis-3d').setAttribute('aria-pressed',String(tilted));if(ready)map.easeTo({pitch:tilted?55:0,bearing:tilted?-18:0,duration:reduced?0:600});});$('gis-reset').addEventListener('click',()=>{detail(null);view('moscow');});
  Promise.all(['data/facilities.json','data/territory.geojson','data/ring-buildings.geojson','data/rail-context.geojson'].map(url=>fetch(url+'?v=3.1').then(r=>{if(!r.ok)throw Error('Data unavailable');return r.json();}))).then(([data,geo,context,rail])=>{validate(data,geo);if(!rail?.metadata?.focus_bbox||!rail.features?.length)throw Error('Invalid rail context');railContext=rail;catalog=data;geography=geo;buildings=context;center=geo.metadata.ring_bbox_center;table();detail(null);tourCopy();$('gis-data-status').textContent=`В подборке: ${catalog.items.length} площадок. Проверено: ${catalog.checkedAt}. «—» означает, что функция не отмечена в подборке, а не доказанное отсутствие.`;startMap();}).catch(()=>{$('gis-data-status').textContent='Подборка пока недоступна. Попробуйте обновить страницу позже.';$('gis-map-status').textContent='Не удалось загрузить проверенные геоданные.';});
})();
