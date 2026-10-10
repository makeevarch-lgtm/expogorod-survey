'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const labels = {science:'Наука',exhibition:'Выставки',education:'Образование'};
  const colors = {science:'#bcc6fb',exhibition:'#fe96c1',education:'#c6d875'};
  const el = (tag,text,className) => {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
  const fmt = n => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n);
  let map, catalog, geography, center, markers=[], filter='all', selected=null, ready=false, tilted=true;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const distance = (a,b) => {const r=Math.PI/180;const dlat=(b[1]-a[1])*r,dlon=(b[0]-a[0])*r;const h=Math.sin(dlat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dlon/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));};
  const isPoint = p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>36&&p[0]<39&&p[1]>54&&p[1]<57;
  function validate(data,geo){
    if(!Array.isArray(data.items)||!data.items.length||!geo.features?.length||!isPoint(geo.metadata?.ring_bbox_center))throw Error('Invalid map dataset');
    const ids=new Set();for(const i of data.items){if(typeof i.id!=='string'||ids.has(i.id)||typeof i.name!=='string'||!isPoint(i.coordinates)||!Array.isArray(i.functions)||!i.functions.length||i.functions.some(f=>!labels[f])||new Set(i.functions).size!==i.functions.length||!/^https:\/\//.test(i.sourceUrl))throw Error('Invalid facility');ids.add(i.id);}
  }
  const visible = () => catalog.items.filter(i=>filter==='all'||filter==='focus'&&Boolean(i.focusReason)||filter==='mixed'&&i.functions.length>1||i.functions.includes(filter));
  function detail(item){
    const target=$('gis-detail');target.replaceChildren();selected=item?.id||null;
    if(!item){target.append(el('h3','Экспериментальное кольцо'),el('p','Щербинка · территория исследования.'),el('p','На карте выделены три действительных кольцевых пути по данным OpenStreetMap. Это геометрия железной дороги, а не граница проектирования.'));const a=el('a','О кольце · ВНИИЖТ ↗');a.href='https://www.vniizht.ru/about/scientific-centers-and-branches/experimental-ring/';a.target='_blank';a.rel='noopener noreferrer';target.append(a);}
    else {target.append(el('h3',item.name));if(item.focusReason)target.append(el('p','Опорный пример · '+item.focusReason,'gis-focus-note'));const tags=el('div',undefined,'gis-tags');item.functions.forEach(f=>{const t=el('span',labels[f],'gis-tag');t.style.background=colors[f]+'99';tags.append(t);});target.append(tags,el('p',item.description),el('p',`${fmt(distance(center,item.coordinates))} км от кольца по прямой.`),el('p',item.access||'Условия посещения уточняйте на официальном сайте.'));const a=el('a','Официальный источник ↗');a.href=item.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';target.append(a);}
    markers.forEach(m=>m.button.classList.toggle('is-selected',m.id===selected));updateLabels();
    document.querySelectorAll('.gis-table tr[data-id]').forEach(row=>row.classList.toggle('is-selected',row.dataset.id===selected));
  }
  function focusItem(item){detail(item);if(ready)map.flyTo({center:item.coordinates,zoom:14.5,pitch:tilted?55:0,bearing:tilted?-18:0,duration:reduced?0:1200});document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));}
  function table(){const items=visible();$('gis-count').textContent=items.length;$('gis-mixed').textContent=items.filter(i=>i.functions.length>1).length;
    const table=el('table',undefined,'gis-table');table.append(el('caption','Выбранные площадки: функции и расстояние до кольца','sr-only'));const head=el('thead'),hr=el('tr');['Площадка','Наука','Выставки','Образование','До кольца, км','Источник'].forEach(t=>{const th=el('th',t);th.scope='col';hr.append(th);});head.append(hr);table.append(head);const body=el('tbody');
    items.slice().sort((a,b)=>distance(center,a.coordinates)-distance(center,b.coordinates)).forEach(item=>{const row=el('tr');row.dataset.id=item.id;const name=el('td');const button=el('button',item.name);button.type='button';button.addEventListener('click',()=>{focusItem(item);$('gis-map').scrollIntoView({behavior:reduced?'auto':'smooth',block:'center'});});name.append(button);if(item.focusReason)name.append(el('small','Опорный пример','gis-table-focus'));row.append(name);Object.keys(labels).forEach(f=>{const cell=el('td');if(item.functions.includes(f)){const dot=el('span',undefined,'function-dot');dot.style.background=colors[f]+'bf';dot.setAttribute('aria-label','Подтверждено источником');cell.append(dot);}else{cell.textContent='—';cell.setAttribute('aria-label','Не отмечено в подборке');}row.append(cell);});row.append(el('td',fmt(distance(center,item.coordinates))));const source=el('td'),link=el('a','Сайт ↗');link.href=item.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';source.append(link);row.append(source);body.append(row);});table.append(body);$('gis-table').replaceChildren(table);if(!items.length)$('gis-table').append(el('p','В подборке пока нет площадок с такой функцией.'));
    markers.forEach(m=>m.marker.getElement().hidden=m.id!=='ring'&&!items.some(i=>i.id===m.id));if(selected&&!items.some(i=>i.id===selected))detail(null);updateLabels();
  }
  function view(which){if(!ready)return;const duration=reduced?0:1200;if(which==='ring'){const b=geography.metadata.ring_bbox;map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:55,pitch:tilted?55:0,bearing:tilted?-20:0,duration,maxZoom:15.2});detail(null);}else{const points=[center,...visible().map(i=>i.coordinates)],bounds=points.reduce((b,p)=>b.extend(p),new maplibregl.LngLatBounds());map.fitBounds(bounds,{padding:{top:80,bottom:70,left:60,right:60},pitch:tilted?48:0,bearing:tilted?-14:0,duration,maxZoom:11});}document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===which)));}
  // Label collisions affect captions only; geographic marker positions never move.
  function updateLabels(){
    if(!map)return;
    const bounds=$('gis-map').getBoundingClientRect(),occupied=[];
    markers.forEach(m=>m.button.classList.remove('has-label'));
    const ordered=markers.filter(m=>!m.button.hidden&&(m.id==='ring'||m.id===selected||m.focus))
      .sort((a,b)=>(b.id===selected?3:b.id==='ring'?2:1)-(a.id===selected?3:a.id==='ring'?2:1));
    for(const m of ordered){
      const pin=m.button.getBoundingClientRect();
      if(pin.right<bounds.left||pin.left>bounds.right||pin.bottom<bounds.top||pin.top>bounds.bottom)continue;
      m.button.classList.add('has-label');
      const label=m.button.querySelector('.gis-pin-label');label.style.marginLeft='0px';
      let r=label.getBoundingClientRect();const shift=Math.max(0,bounds.left+8-r.left)-Math.max(0,r.right-bounds.right+8);
      label.style.marginLeft=shift+'px';r=label.getBoundingClientRect();
      if(occupied.some(o=>r.left<o.right+8&&r.right>o.left-8&&r.top<o.bottom+8&&r.bottom>o.top-8))m.button.classList.remove('has-label');
      else occupied.push(r);
    }
  }
  function marker(point,id,name,functions,focusReason,shortName){
    const button=el('button',undefined,'gis-pin'+(id==='ring'?' gis-pin-ring':focusReason?' gis-pin-focus':''));
    button.type='button';button.setAttribute('aria-label',name);button.title=name;
    button.append(el('span',shortName||name,'gis-pin-label'));
    if(functions?.length){const alpha=focusReason?'bf':'80';const stops=functions.map((f,i)=>`${colors[f]}${alpha} ${i*100/functions.length}% ${(i+1)*100/functions.length}%`);button.style.setProperty('background',`conic-gradient(${stops.join(',')})`,'important');}
    button.addEventListener('click',()=>id==='ring'?view('ring'):focusItem(catalog.items.find(i=>i.id===id)));
    const m=new maplibregl.Marker({element:button}).setLngLat(point).addTo(map);markers.push({id,marker:m,button,focus:Boolean(focusReason)});
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
    try{map=new maplibregl.Map({container:'gis-map',style:'https://tiles.openfreemap.org/styles/positron',center,zoom:10,pitch:48,bearing:-14,maxZoom:18,minZoom:7,maxBounds:[[36.5,55.1],[38.7,56.2]],attributionControl:true,cooperativeGestures:true,canvasContextAttributes:{antialias:true}});}catch(e){$('gis-map-status').textContent='Не удалось запустить карту. Посмотрите сравнение площадок в таблице ниже.';return;}
    map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');map.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-left');
    map.on('error',()=>{if(!ready){$('gis-map-status').hidden=false;$('gis-map-status').textContent='Базовая карта загружается с задержкой. Таблица площадок доступна ниже.';}});
    map.on('load',()=>{
      try {
        const layers=map.getStyle().layers;const symbol=layers.find(l=>l.type==='symbol');
        minimalBasemap();
        map.addLayer({id:'expo-buildings',type:'fill-extrusion',source:'openmaptiles','source-layer':'building',minzoom:14,filter:['!=',['get','hide_3d'],true],paint:{'fill-extrusion-color':'#c4c4c4','fill-extrusion-height':['coalesce',['get','render_height'],0],'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':.85}},symbol?.id);
        map.addSource('expo-ring',{type:'geojson',data:geography});map.addLayer({id:'expo-ring-halo',type:'line',source:'expo-ring',filter:['==',['get','kind'],'ring'],paint:{'line-color':'#bcc6fb','line-width':['interpolate',['linear'],['zoom'],8,6,15,16],'line-opacity':.5,'line-blur':5}});map.addLayer({id:'expo-ring-line',type:'line',source:'expo-ring',filter:['==',['get','kind'],'ring'],paint:{'line-color':'#414cda','line-width':['interpolate',['linear'],['zoom'],8,2,15,3],'line-opacity':.9}});
        marker(center,'ring','Экспериментальное кольцо',null,null,'Кольцо ВНИИЖТ');catalog.items.forEach(i=>marker(i.coordinates,i.id,i.name,i.functions,i.focusReason,i.shortName));map.on('moveend',updateLabels);map.on('resize',updateLabels);ready=true;$('gis-map-status').hidden=true;table();view('moscow');
      }catch(e){$('gis-map-status').hidden=false;$('gis-map-status').textContent='Не удалось отобразить все слои карты. Подборка площадок доступна в таблице.';}
    });
    setTimeout(()=>{if(!ready){$('gis-map-status').hidden=false;$('gis-map-status').textContent='Карта пока недоступна. Можно сравнить площадки в таблице или перезагрузить страницу.';}},20000);
  }
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{if(!catalog)return;filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));table();view('moscow');}));
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));
  $('gis-3d').addEventListener('click',()=>{tilted=!tilted;$('gis-3d').setAttribute('aria-pressed',String(tilted));if(ready)map.easeTo({pitch:tilted?55:0,bearing:tilted?-18:0,duration:reduced?0:600});});$('gis-reset').addEventListener('click',()=>{detail(null);view('moscow');});
  Promise.all(['data/facilities.json','data/territory.geojson'].map(url=>fetch(url+'?v=2.12').then(r=>{if(!r.ok)throw Error('Data unavailable');return r.json();}))).then(([data,geo])=>{validate(data,geo);catalog=data;geography=geo;center=geo.metadata.ring_bbox_center;table();detail(null);$('gis-data-status').textContent=`В подборке: ${catalog.items.length} площадок. Проверено: ${catalog.checkedAt}. «—» означает, что функция не отмечена в подборке, а не доказанное отсутствие.`;startMap();}).catch(()=>{$('gis-data-status').textContent='Подборка пока недоступна. Попробуйте обновить страницу позже.';$('gis-map-status').textContent='Не удалось загрузить проверенные геоданные.';});
})();
