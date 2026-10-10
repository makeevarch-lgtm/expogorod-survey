'use strict';
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const colors = ['#bcc6fb', '#9baafa', '#fe96c1', '#ee6da7', '#c6d875', '#9dae50', '#6978d9'];
  const format = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
  const number = (value) => format.format(value);
  const percent = (count, base) => base ? `${number(100 * count / base)}%` : '—';
  const key = (index) => String(index + 1).padStart(2, '0');
  const html = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const svg = (tag, attrs = {}, text) => {
    const element = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, value));
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const mount = (id) => {
    const element = document.getElementById(id);
    if (element) element.replaceChildren();
    return element;
  };
  const note = (text) => html('p', text, 'chart-note');

  function renderBars(network) {
    const target = mount('interest-bars');
    if (!target) return;
    const list = html('ol', undefined, 'interest-bars');
    network.nodes.forEach((item, index) => {
      const row = html('li', undefined, 'interest-bar');
      const label = html('div', undefined, 'interest-bar-label');
      label.append(html('span', key(index), 'chart-number'), html('span', item.label));
      const track = html('div', undefined, 'interest-bar-track');
      track.setAttribute('aria-hidden', 'true');
      const fill = html('span');
      fill.style.width = `${network.base ? 100 * item.count / network.base : 0}%`;
      fill.style.backgroundColor = `${colors[index]}bf`;
      track.append(fill);
      const value = html('div', undefined, 'interest-bar-value');
      value.append(html('strong', `${number(item.count)} из ${number(network.base)}`), html('span', percent(item.count, network.base)));
      row.append(label, track, value);
      list.append(row);
    });
    target.append(list, note(network.base
      ? `Ответов на вопрос: ${number(network.base)}. Можно было выбрать несколько вариантов, поэтому сумма процентов может быть больше 100%.`
      : 'Нет корректных ответов на этот вопрос. Нулевые полосы не означают отсутствие интереса.'));
  }

  function ring(id, segments, total, center, subline, description) {
    const graphic = svg('svg', { viewBox: '0 0 260 260', class: 'chart-donut', role: 'img', 'aria-labelledby': `${id}-title ${id}-desc` });
    graphic.append(svg('title', { id: `${id}-title` }, subline), svg('desc', { id: `${id}-desc` }, description));
    graphic.append(svg('circle', { cx: 130, cy: 130, r: 94, fill: 'none', stroke: '#e8e8e8', 'stroke-width': 31 }));
    const circumference = 2 * Math.PI * 94;
    let offset = 0;
    if (total) segments.forEach((segment) => {
      if (!segment.count) return;
      const length = circumference * segment.count / total;
      // A complete circumference is valid even for the 100% / one-segment case.
      graphic.append(svg('circle', {
        cx: 130, cy: 130, r: 94, fill: 'none', stroke: segment.color, 'stroke-width': 31, 'stroke-opacity': .76,
        'stroke-dasharray': `${length} ${Math.max(0, circumference - length)}`,
        'stroke-dashoffset': -offset, transform: 'rotate(-90 130 130)'
      }));
      offset += length;
    });
    graphic.append(svg('circle', { cx: 130, cy: 130, r: 109.5, fill: 'none', stroke: '#171717', 'stroke-width': 1.8 }));
    graphic.append(svg('circle', { cx: 130, cy: 130, r: 78.5, fill: 'none', stroke: '#171717', 'stroke-width': 1.8 }));
    graphic.append(svg('text', { x: 130, y: 129, 'text-anchor': 'middle', class: 'chart-donut-value' }, total ? center : '—'));
    graphic.append(svg('text', { x: 130, y: 151, 'text-anchor': 'middle', class: 'chart-donut-subline' }, total ? subline : 'нет данных'));
    return graphic;
  }

  function legendRow(label, value, color, index) {
    const row = html('li');
    const swatch = html('span', index === undefined ? '' : key(index), 'chart-legend-swatch');
    swatch.style.backgroundColor = `${color}bf`;
    swatch.setAttribute('aria-hidden', 'true');
    row.append(swatch, html('span', label), html('strong', value));
    return row;
  }

  function renderVisit(interested) {
    const target = mount('visit-donut');
    if (!target) return;
    const other = interested.base - interested.count;
    const segments = [{ count: interested.count, color: '#bcc6fb' }, { count: other, color: '#e8e8e8' }];
    const content = html('div', undefined, 'chart-donut-layout');
    content.append(ring('visit-ring', segments, interested.base, `${number(interested.count)} / ${number(interested.base)}`, 'хотели бы приехать',
      `Хотели бы приехать: ${interested.count} из ${interested.base}, ${percent(interested.count, interested.base)}. Другие ответы: ${other}.`));
    const list = html('ul', undefined, 'chart-legend');
    list.append(legendRow('Хотели бы приехать', `${number(interested.count)} · ${percent(interested.count, interested.base)}`, '#bcc6fb'),
      legendRow('Другие ответы', `${number(other)} · ${percent(other, interested.base)}`, '#e8e8e8'));
    content.append(list);
    target.append(content, note(interested.base
      ? `Ответов в основании: ${number(interested.base)}. «Хотели бы приехать» — «определённо» или «скорее посетил(а) бы». «Другие ответы» включают остальные варианты, в том числе «трудно сказать».`
      : 'На вопрос о желании приехать пока нет корректных ответов.'));
  }

  function renderShare(network) {
    const target = mount('choice-share');
    if (!target) return;
    const total = network.nodes.reduce((sum, item) => sum + item.count, 0);
    const segments = network.nodes.map((item, index) => ({ count: item.count, color: colors[index] }));
    const content = html('div', undefined, 'chart-donut-layout');
    content.append(ring('choice-ring', segments, total, number(total), 'выборов интересов',
      `Всего ${total} выборов интересов в ${network.base} ответах. Доли рассчитаны от числа выборов, а не от числа анкет. ${network.nodes.map((item) => `${item.label}: ${item.count}`).join('. ')}.`));
    const list = html('ul', undefined, 'chart-legend chart-legend-compact');
    network.nodes.forEach((item, index) => list.append(legendRow(item.label, `${number(item.count)} · ${percent(item.count, total)}`, colors[index], index)));
    content.append(list);
    target.append(content, note(total
      ? `Основание: ${number(total)} выборов в ${number(network.base)} ответах. Каждая отметка считается отдельно. Это доли выборов, а не доли участников; сумма округлённых значений может отличаться от 100%.`
      : 'Конкретные интересы пока не выбраны — распределение появится после первых отметок.'));
  }

  function renderMatrix(network) {
    const target = mount('interest-matrix');
    if (!target) return;
    const lookup = new Map(network.edges.flatMap((edge) => [[`${edge.source}|${edge.target}`, edge.count], [`${edge.target}|${edge.source}`, edge.count]]));
    const content = html('div', undefined, 'chart-matrix-layout');
    const scroll = html('div', undefined, 'chart-matrix-scroll');
    const table = html('table', undefined, 'chart-matrix');
    table.append(html('caption', `Совместный выбор интересов · ответов: ${number(network.base)}`, 'sr-only'));
    const head = html('thead'); const header = html('tr');
    const corner = html('th', '№'); corner.scope = 'col'; header.append(corner);
    network.nodes.forEach((item, index) => { const th = html('th', key(index)); th.scope = 'col'; th.setAttribute('aria-label', `${key(index)}. ${item.label}`); header.append(th); });
    head.append(header); table.append(head);
    const body = html('tbody');
    network.nodes.forEach((row, i) => {
      const line = html('tr'); const th = html('th', key(i)); th.scope = 'row'; th.setAttribute('aria-label', `${key(i)}. ${row.label}`); line.append(th);
      network.nodes.forEach((column, j) => {
        const count = i === j ? row.count : lookup.get(`${row.id}|${column.id}`) || 0;
        const cell = html('td', network.base ? number(count) : '—');
        if (i === j) cell.className = 'matrix-diagonal';
        else if (count) cell.style.backgroundColor = `rgba(155,170,250,${.14 + .62 * count / network.base})`;
        cell.setAttribute('aria-label', `${row.label}${i === j ? ': всего выборов' : ` + ${column.label}: выбраны вместе`}. ${network.base ? count : 'Нет данных'}`);
        line.append(cell);
      });
      body.append(line);
    });
    table.append(body); scroll.append(table); content.append(scroll);
    const list = html('ol', undefined, 'chart-matrix-key');
    network.nodes.forEach((item, index) => { const li = html('li'); li.append(html('span', key(index), 'chart-number'), html('span', item.label)); list.append(li); });
    content.append(list);
    const scale = html('div', undefined, 'chart-matrix-scale');
    const gradient = html('span', undefined, 'chart-scale-gradient'); gradient.setAttribute('aria-hidden', 'true');
    scale.append(html('span', '0'), gradient, html('span', number(network.base)));
    target.append(content, scale, note('Число в ячейке — количество анкет, где два интереса выбраны вместе. На серой диагонали — общее число выборов каждого интереса. Матрица симметрична: каждая пара показана дважды.'));
  }

  // Data is validated by results.js before being passed to this presentation layer.
  window.EXPO_CHARTS = Object.freeze({ render(data) {
    renderBars(data.network);
    renderVisit(data.interested);
    renderShare(data.network);
    renderMatrix(data.network);
  } });
})();
