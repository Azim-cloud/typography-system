const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat('ru-RU').format(n || 0) + ' ₽';

let tekFilterStatus = '';
let tekFilterDay = 0;
let tekushchiyPoisk = '';

function klassStatusa(s) {
    return { 'Новый':'jeltiy', 'В печати':'siniy', 'Готов':'zeleniy', 'Отменен':'seryy' }[s] || 'jeltiy';
}

function zakrytModal(id) { $('#' + id).classList.remove('otkryt'); }
function otkrytModal(id) { $('#' + id).classList.add('otkryt'); }

function showView(name, params) {
    params = params || {};

    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.menu a').forEach(a => a.classList.remove('aktiv'));

    const view = $('#view-' + name);
    if (view) view.style.display = 'block';
    const link = document.querySelector(`[data-view="${name}"]`);
    if (link) link.classList.add('aktiv');

    // Применяем фильтры при переходе в заказы
    if (name === 'orders') {
        if (params.status !== undefined) tekFilterStatus = params.status;
        if (params.day !== undefined) tekFilterDay = params.day;
        if (params.reset) {
            tekFilterStatus = '';
            tekFilterDay = 0;
            tekushchiyPoisk = '';
            const gp = $('#globalnyyPoisk');
            if (gp) gp.value = '';
        }
    }

    if (name === 'dashboard') renderDashboard();
    if (name === 'orders') renderOrders();
    if (name === 'clients') renderClients();
    if (name === 'production') renderProduction();
    if (name === 'settings') renderSettings();
}

function refreshCurrent() {
    const active = document.querySelector('.menu a.aktiv');
    if (!active) return;
    const view = active.dataset.view;
    if (view === 'dashboard') renderDashboard();
    if (view === 'orders') renderOrders();
    if (view === 'clients') renderClients();
    if (view === 'production') renderProduction();
    if (view === 'settings') renderSettings();
}

async function renderDashboard() {
    const orders = await getAll('orders');
    const clients = await getAll('clients');
    const services = await getAll('services');

    const today = new Date().toISOString().slice(0, 10);

    const newCnt = orders.filter(o => o.status === 'Новый').length;
    const printCnt = orders.filter(o => o.status === 'В печати').length;
    const readyCnt = orders.filter(o => o.status === 'Готов').length;
    const overdueCnt = orders.filter(o =>
        o.status !== 'Готов' && o.status !== 'Отменен' && o.due_date < today
    ).length;
    const revenue = orders.filter(o => o.status !== 'Отменен')
                          .reduce((s, o) => s + (o.total || 0), 0);

    $('#kpi-new').textContent = newCnt;
    $('#kpi-print').textContent = printCnt;
    $('#kpi-ready').textContent = readyCnt;
    $('#kpi-overdue').textContent = overdueCnt;
    $('#kpi-revenue').textContent = money(revenue);

    const days = [0, 0, 0, 0, 0, 0, 0];
    orders.forEach(o => {
        if (o.day >= 1 && o.day <= 7) days[o.day - 1]++;
    });
    const maxDay = Math.max.apply(null, days.concat([1]));
    const dni = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    $('#grafik').innerHTML = dni.map(function(d, i) {
        const h = Math.round(days[i] / maxDay * 150);
        return '<div class="stolbik" style="height:' + Math.max(h, 4) + 'px;cursor:pointer"'
            + ' onclick="showView(\'orders\',{day:' + (i + 1) + '})"'
            + ' title="' + days[i] + ' заказов">'
            + '<b>' + days[i] + '</b><span>' + d + '</span></div>';
    }).join('');

    const last = orders.slice().sort((a, b) => b.id - a.id).slice(0, 5);
    if (last.length === 0) {
        $('#dashboard-last-orders').innerHTML =
            '<tr><td colspan="5" class="pusto">Заказов пока нет</td></tr>';
    } else {
        $('#dashboard-last-orders').innerHTML = last.map(o => {
            const c = clients.find(x => x.id === o.client_id) || {};
            const s = services.find(x => x.id === o.service_id) || {};
            return '<tr style="cursor:pointer" onclick="openOrderModal(' + o.id + ')">'
                + '<td><b>№' + o.number + '</b></td>'
                + '<td>' + (c.name || '—') + '</td>'
                + '<td>' + (s.name || '—') + '</td>'
                + '<td>' + money(o.total) + '</td>'
                + '<td><span class="tag ' + klassStatusa(o.status) + '">' + o.status + '</span></td>'
                + '</tr>';
        }).join('');
    }

    const stats = {};
    orders.forEach(o => {
        if (o.status === 'Отменен') return;
        if (!stats[o.client_id]) stats[o.client_id] = { count: 0, sum: 0 };
        stats[o.client_id].count++;
        stats[o.client_id].sum += (o.total || 0);
    });
    const top = Object.keys(stats)
        .map(id => ({ id: +id, count: stats[id].count, sum: stats[id].sum }))
        .sort((a, b) => b.sum - a.sum)
        .slice(0, 5);

    if (top.length === 0) {
        $('#dashboard-top-clients').innerHTML =
            '<tr><td colspan="3" class="pusto">Нет данных</td></tr>';
    } else {
        $('#dashboard-top-clients').innerHTML = top.map(t => {
            const c = clients.find(x => x.id === t.id) || {};
            return '<tr><td>' + (c.name || '—') + '</td>'
                + '<td>' + t.count + '</td>'
                + '<td>' + money(t.sum) + '</td></tr>';
        }).join('');
    }

    updateBadge();
}

async function renderOrders() {
    const orders = await getAll('orders');
    const clients = await getAll('clients');
    const services = await getAll('services');

    const selStatus = $('#filter-status');
    if (selStatus) selStatus.value = tekFilterStatus;

    const fDate = ($('#filter-date') && $('#filter-date').value) || '';

    let list = orders.slice().sort((a, b) => b.id - a.id);

    if (tekFilterStatus) list = list.filter(o => o.status === tekFilterStatus);
    if (fDate) list = list.filter(o => o.created_at === fDate);
    if (tekFilterDay) list = list.filter(o => o.day === tekFilterDay);
    if (tekushchiyPoisk) {
        const q = tekushchiyPoisk.toLowerCase();
        list = list.filter(o => {
            const c = clients.find(x => x.id === o.client_id) || {};
            return o.number.toLowerCase().indexOf(q) !== -1 ||
                   (c.name || '').toLowerCase().indexOf(q) !== -1;
        });
    }

    const today = new Date().toISOString().slice(0, 10);

    let info = 'Найдено: ' + list.length;
    if (tekFilterDay) info += ' (день: ' + ['','Пн','Вт','Ср','Чт','Пт','Сб','Вс'][tekFilterDay] + ')';
    if (tekFilterStatus) info += ' (' + tekFilterStatus + ')';
    $('#orders-count').textContent = info;

    if (list.length === 0) {
        $('#orders-tbody').innerHTML = '<tr><td colspan="7" class="pusto">Ничего не найдено</td></tr>';
        return;
    }

    $('#orders-tbody').innerHTML = list.map(o => {
        const c = clients.find(x => x.id === o.client_id) || {};
        const s = services.find(x => x.id === o.service_id) || {};
        const isOverdue = o.due_date && o.due_date < today &&
                          o.status !== 'Готов' && o.status !== 'Отменен';
        return '<tr>'
            + '<td><a class="ssylka" onclick="openOrderModal(' + o.id + ')">№' + o.number + '</a></td>'
            + '<td>' + (c.name || '—') + '</td>'
            + '<td>' + (s.name || '—') + ' <small style="color:var(--seryy)">' + (s.format || '') + '</small></td>'
            + '<td>' + money(o.total) + '</td>'
            + '<td>' + (o.due_date || '—') + '</td>'
            + '<td><span class="tag ' + (isOverdue ? 'krasniy' : klassStatusa(o.status)) + '">'
            + (isOverdue ? 'Просрочен' : o.status) + '</span></td>'
            + '<td>'
            + '<span class="ikonka" onclick="openOrderModal(' + o.id + ')" title="Редактировать">✏️</span>'
            + '<span class="ikonka" onclick="openHistory(' + o.id + ')" title="История">📜</span>'
            + '<span class="ikonka" onclick="deleteOrder(' + o.id + ')" title="Удалить">🗑️</span>'
            + '</td></tr>';
    }).join('');
}

function resetFilters() {
    tekFilterStatus = '';
    tekFilterDay = 0;
    tekushchiyPoisk = '';
    if ($('#filter-status')) $('#filter-status').value = '';
    if ($('#filter-date')) $('#filter-date').value = '';
    if ($('#globalnyyPoisk')) $('#globalnyyPoisk').value = '';
    renderOrders();
}

async function openOrderModal(id) {
    const clients = await getAll('clients');
    const services = await getAll('services');

    $('#order-client').innerHTML = clients.map(c =>
        '<option value="' + c.id + '">' + c.name + '</option>'
    ).join('');

    $('#order-service').innerHTML = services.map(s =>
        '<option value="' + s.id + '">' + s.name + ' — ' + s.format + ' — ' + s.price + '₽</option>'
    ).join('');

    if (id) {
        const o = await getById('orders', id);
        $('#order-modal-title').textContent = 'Редактировать заказ №' + o.number;
        $('#order-id').value = o.id;
        $('#order-client').value = o.client_id;
        $('#order-service').value = o.service_id;
        $('#order-qty').value = o.quantity;
        $('#order-date').value = o.due_date;
        $('#order-status').value = o.status;
        $('#order-comment').value = o.comment || '';
    } else {
        $('#order-modal-title').textContent = 'Новый заказ';
        $('#order-id').value = '';
        $('#order-qty').value = 100;
        $('#order-date').value = new Date().toISOString().slice(0, 10);
        $('#order-status').value = 'Новый';
        $('#order-comment').value = '';
    }
    otkrytModal('modalOrder');
}

async function saveOrder(e) {
    e.preventDefault();
    const services = await getAll('services');
    const id = $('#order-id').value;
    const srv = services.find(s => s.id === +$('#order-service').value);
    const total = (srv ? srv.price : 0) * +$('#order-qty').value;

    const data = {
        client_id: +$('#order-client').value,
        service_id: +$('#order-service').value,
        quantity: +$('#order-qty').value,
        total: total,
        due_date: $('#order-date').value,
        status: $('#order-status').value,
        comment: $('#order-comment').value
    };

    if (id) {
        data.id = +id;
        const old = await getById('orders', +id);
        data.number = old.number;
        data.created_at = old.created_at;
        data.machine = old.machine;
        data.day = old.day;
        await put('orders', data);
        await logHistory(data.id, 'Заказ отредактирован');
    } else {
        const orders = await getAll('orders');
        data.number = (orders.length + 1) + '-2026-' + String(data.client_id).padStart(2, '0');
        data.created_at = new Date().toISOString().slice(0, 10);
        data.machine = 1;
        data.day = 1;
        const newId = await add('orders', data);
        await logHistory(newId, 'Заказ создан');
    }

    zakrytModal('modalOrder');
    updateBadge();
    refreshCurrent();
}

async function deleteOrder(id) {
    if (!confirm('Удалить заказ?')) return;
    await deleteById('orders', id);
    updateBadge();
    refreshCurrent();
}

async function openHistory(orderId) {
    const tx = db.transaction('history', 'readonly');
    const idx = tx.objectStore('history').index('order_id');
    const req = idx.getAll(orderId);

    req.onsuccess = function() {
        const hist = req.result.reverse();
        if (hist.length === 0) {
            $('#history-list').innerHTML = '<p class="pusto">История пуста</p>';
        } else {
            $('#history-list').innerHTML = hist.map(h =>
                '<div class="istoriya-element">'
                + '<div>' + h.action + '</div>'
                + '<div class="vremya">' + h.created_at + '</div>'
                + '</div>'
            ).join('');
        }
        otkrytModal('modalHistory');
    };
}

async function renderClients() {
    const clients = await getAll('clients');
    const orders = await getAll('orders');

    if (clients.length === 0) {
        $('#clients-tbody').innerHTML = '<tr><td colspan="7" class="pusto">Нет клиентов</td></tr>';
        return;
    }

    $('#clients-tbody').innerHTML = clients.map(c => {
        const cnt = orders.filter(o => o.client_id === c.id).length;
        return '<tr>'
            + '<td><b>' + c.name + '</b></td>'
            + '<td>' + c.type + '</td>'
            + '<td>' + (c.phone || '—') + '</td>'
            + '<td>' + (c.email || '—') + '</td>'
            + '<td>' + (c.address || '—') + '</td>'
            + '<td>' + cnt + '</td>'
            + '<td>'
            + '<span class="ikonka" onclick="openClientModal(' + c.id + ')" title="Редактировать">✏️</span>'
            + '<span class="ikonka" onclick="deleteClient(' + c.id + ')" title="Удалить">🗑️</span>'
            + '</td></tr>';
    }).join('');
}

async function openClientModal(id) {
    let c = { name: '', type: 'Юрлицо', phone: '', email: '', address: '', inn: '' };
    if (id) {
        const found = await getById('clients', id);
        if (found) c = found;
    }
    $('#client-modal-title').textContent = id ? 'Редактировать клиента' : 'Новый клиент';
    $('#client-id').value = c.id || '';
    $('#client-name').value = c.name || '';
    $('#client-type').value = c.type || 'Юрлицо';
    $('#client-phone').value = c.phone || '';
    $('#client-email').value = c.email || '';
    $('#client-address').value = c.address || '';
    $('#client-inn').value = c.inn || '';
    otkrytModal('modalClient');
}

async function saveClient(e) {
    e.preventDefault();
    const id = $('#client-id').value;
    const data = {
        name: $('#client-name').value.trim(),
        type: $('#client-type').value,
        phone: $('#client-phone').value,
        email: $('#client-email').value,
        address: $('#client-address').value,
        inn: $('#client-inn').value
    };
    if (id) {
        data.id = +id;
        await put('clients', data);
    } else {
        await add('clients', data);
    }
    zakrytModal('modalClient');
    refreshCurrent();
}

async function deleteClient(id) {
    if (!confirm('Удалить клиента?')) return;
    await deleteById('clients', id);
    refreshCurrent();
}

async function renderProduction() {
    const orders = await getAll('orders');
    const clients = await getAll('clients');
    const dni = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

    let html = '<div class="gantt-shapka"></div>';
    html += dni.map(d => '<div class="gantt-shapka">' + d + '</div>').join('');

    for (let s = 1; s <= 4; s++) {
        html += '<div class="gantt-stanok">Станок ' + s + '</div>';
        for (let d = 1; d <= 7; d++) {
            const o = orders.find(x => x.machine === s && x.day === d && x.status !== 'Отменен');
            let plita = '';
            if (o) {
                const c = clients.find(x => x.id === o.client_id) || {};
                const name = (c.name || '').slice(0, 18);
                plita = '<div class="plita ' + klassStatusa(o.status) + '" draggable="true"'
                    + ' ondragstart="dragStart(event,' + o.id + ')">'
                    + '№' + o.number + '<br><small>' + name + '</small></div>';
            }
            html += '<div class="gantt-yacheyka"'
                + ' ondragover="dragOver(event,this)"'
                + ' ondragleave="dragLeave(this)"'
                + ' ondrop="drop(event,' + s + ',' + d + ',this)">'
                + plita + '</div>';
        }
    }
    $('#gantt-grid').innerHTML = html;
}

function dragStart(e, id) { e.dataTransfer.setData('id', String(id)); }
function dragOver(e, el) { e.preventDefault(); el.classList.add('naveden'); }
function dragLeave(el) { el.classList.remove('naveden'); }

async function drop(e, s, d, el) {
    e.preventDefault();
    el.classList.remove('naveden');
    const id = +e.dataTransfer.getData('id');
    if (!id) return;
    const o = await getById('orders', id);
    if (!o) return;
    o.machine = s;
    o.day = d;
    await put('orders', o);
    await logHistory(id, 'Перенос: Станок ' + s + ', день ' + d);
    renderProduction();
}

async function renderSettings() {
    const orders = await getAll('orders');
    const clients = await getAll('clients');
    const today = new Date().toISOString().slice(0, 10);

    const overdue = orders.filter(o =>
        o.status !== 'Готов' && o.status !== 'Отменен' && o.due_date < today
    ).length;
    const revenue = orders.filter(o => o.status !== 'Отменен')
                          .reduce((s, o) => s + (o.total || 0), 0);

    $('#stat-orders').textContent = orders.length;
    $('#stat-clients').textContent = clients.length;
    $('#stat-overdue').textContent = overdue;
    $('#stat-revenue').textContent = money(revenue);
}

async function eksportCSV() {
    const orders = await getAll('orders');
    const clients = await getAll('clients');
    const services = await getAll('services');

    const lines = ['Номер;Клиент;Продукт;Сумма;Срок;Статус'];
    orders.forEach(o => {
        const c = clients.find(x => x.id === o.client_id) || {};
        const s = services.find(x => x.id === o.service_id) || {};
        lines.push('"' + o.number + '";"' + (c.name || '') + '";"' + (s.name || '')
            + '";"' + o.total + '";"' + o.due_date + '";"' + o.status + '"');
    });

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'zakazy.csv';
    a.click();
}

let poiskTimer;
function poiskZakazov(q) {
    clearTimeout(poiskTimer);
    tekushchiyPoisk = q.trim();
    poiskTimer = setTimeout(function() {
        const active = document.querySelector('.menu a.aktiv');
        if (!active || active.dataset.view !== 'orders') {
            showView('orders');
        } else {
            renderOrders();
        }
    }, 300);
}

async function updateBadge() {
    const orders = await getAll('orders');
    const today = new Date().toISOString().slice(0, 10);
    const overdue = orders.filter(o =>
        o.status !== 'Готов' && o.status !== 'Отменен' && o.due_date < today
    ).length;
    const b = $('#badge');
    if (!b) return;
    b.textContent = overdue;
    b.style.display = overdue > 0 ? 'flex' : 'none';
}

async function otkrytUved() {
    const orders = await getAll('orders');
    const clients = await getAll('clients');
    const today = new Date().toISOString().slice(0, 10);
    const overdue = orders.filter(o =>
        o.status !== 'Готов' && o.status !== 'Отменен' && o.due_date < today
    );

    if (overdue.length === 0) {
        $('#overdue-list').innerHTML = '<p class="pusto">Просроченных заказов нет</p>';
    } else {
        $('#overdue-list').innerHTML = overdue.map(o => {
            const c = clients.find(x => x.id === o.client_id) || {};
            return '<div class="istoriya-element">'
                + '<div><b>№' + o.number + '</b> — ' + (c.name || '') + '</div>'
                + '<div class="vremya">срок ' + o.due_date + '</div>'
                + '</div>';
        }).join('');
    }
    otkrytModal('modalOverdue');
}

function toggleTema() {
    const t = document.body.classList.toggle('temnaya');
    localStorage.setItem('temnaya', t ? '1' : '0');
}

async function sbrositDannye() {
    if (!confirm('Удалить ВСЕ данные и создать заново?')) return;
    if (!confirm('Точно? Это необратимо.')) return;

    await new Promise(function(resolve) {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
    });

    location.reload();
}

document.addEventListener('DOMContentLoaded', async function() {
    await initDB();
    await seedData();

    if (localStorage.getItem('temnaya') === '1') {
        document.body.classList.add('temnaya');
    }

    // Закрытие модалок по клику на фон
    document.querySelectorAll('.fon-modala').forEach(function(m) {
        m.addEventListener('click', function(e) {
            if (e.target === m) m.classList.remove('otkryt');
        });
    });

    // Escape закрывает модалки
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.fon-modala.otkryt').forEach(function(m) {
                m.classList.remove('otkryt');
            });
        }
    });

    showView('dashboard');
});