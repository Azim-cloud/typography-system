const DB_NAME = 'TipografiyaDB';
const DB_VERSION = 1;
let db = null;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains('clients')) {
                database.createObjectStore('clients', { keyPath: 'id', autoIncrement: true });
            }
            if (!database.objectStoreNames.contains('services')) {
                database.createObjectStore('services', { keyPath: 'id', autoIncrement: true });
            }
            if (!database.objectStoreNames.contains('orders')) {
                const s = database.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
                s.createIndex('client_id', 'client_id');
                s.createIndex('status', 'status');
            }
            if (!database.objectStoreNames.contains('history')) {
                const h = database.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
                h.createIndex('order_id', 'order_id');
            }
        };
        request.onsuccess = (e) => { db = e.target.result; resolve(); };
        request.onerror = (e) => reject(e.target.error);
    });
}

function getAll(store) {
    return new Promise((resolve, reject) => {
        const req = db.transaction(store, 'readonly').objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function getById(store, id) {
    return new Promise((resolve, reject) => {
        const req = db.transaction(store, 'readonly').objectStore(store).get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function add(store, data) {
    return new Promise((resolve, reject) => {
        const req = db.transaction(store, 'readwrite').objectStore(store).add(data);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function put(store, data) {
    return new Promise((resolve, reject) => {
        const req = db.transaction(store, 'readwrite').objectStore(store).put(data);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function deleteById(store, id) {
    return new Promise((resolve, reject) => {
        const req = db.transaction(store, 'readwrite').objectStore(store).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function seedData() {
    const clients = await getAll('clients');
    if (clients.length > 0) return;

    const clientsData = [
        ['ООО «Ромашка»', 'Юрлицо', '+7 900 111-22-33', 'romashka@mail.ru', 'г. Москва, ул. Ленина, 5', '7701234567'],
        ['ИП Иванов', 'Физлицо', '+7 900 222-33-44', 'ivanov@mail.ru', 'г. Москва, ул. Мира, 12', '—'],
        ['ООО «Альфа»', 'Юрлицо', '+7 900 333-44-55', 'alfa@mail.ru', 'г. Химки, ул. Победы, 3', '7809876543'],
        ['Кофейня «Бин»', 'Юрлицо', '+7 900 444-55-66', 'bin@mail.ru', 'г. Москва, Тверская, 8', '7712345678'],
        ['Спортзал «Титан»', 'Юрлицо', '+7 900 555-66-77', 'titan@mail.ru', 'г. Москва, Спортивная, 1', '7798765432']
    ];
    for (const c of clientsData) {
        await add('clients', { name: c[0], type: c[1], phone: c[2], email: c[3], address: c[4], inn: c[5] });
    }

    const servicesData = [
        ['Визитка', 'А6 (90×50)', 'Мелованная 300 г', '4+4', 8],
        ['Буклет', 'А4 (евро)', 'Мелованная 150 г', '4+4', 35],
        ['Плакат', 'А3', 'Офсетная 120 г', '4+0', 60],
        ['Листовка', 'А5', 'Офсетная 80 г', '1+1', 5],
        ['Плакат', 'А2', 'Картон 250 г', '4+0', 120],
        ['Буклет', 'А5', 'Мелованная 200 г', '4+4', 22]
    ];
    for (const s of servicesData) {
        await add('services', { name: s[0], format: s[1], paper: s[2], color: s[3], price: s[4] });
    }

    const dt = (d) => {
        const date = new Date();
        date.setDate(date.getDate() + d);
        return date.toISOString().slice(0, 10);
    };

    const ordersData = [
        [1, 1, 1000, 8000, dt(-2), dt(3), 'Новый', 'Ламинация матовая', 1, 1],
        [2, 2, 200, 7000, dt(-3), dt(1), 'В печати', '', 2, 2],
        [3, 3, 150, 9000, dt(-5), dt(-1), 'Готов', '', 1, 3],
        [4, 1, 5000, 25000, dt(-1), dt(4), 'В печати', '', 2, 5],
        [5, 4, 300, 6600, dt(-1), dt(5), 'Новый', '', 3, 4],
        [6, 5, 2000, 16000, dt(0), dt(6), 'Новый', '', 1, 7],
        [7, 2, 50, 6000, dt(-7), dt(-2), 'Готов', '', 3, 6],
        [8, 3, 400, 14000, dt(-6), dt(0), 'Отменен', '', 4, 6],
        [9, 5, 80, 4800, dt(0), dt(7), 'Новый', '', 1, 1],
        [10, 4, 10000, 50000, dt(-2), dt(2), 'В печати', '', 4, 4],
        [11, 1, 30, 3600, dt(-8), dt(-3), 'Готов', '', 1, 1]
    ];
    let n = 1;
    for (const o of ordersData) {
        await add('orders', {
            number: `${n}-2026-${String(o[0]).padStart(2, '0')}`,
            client_id: o[0], service_id: o[1], quantity: o[2], total: o[3],
            created_at: o[4], due_date: o[5], status: o[6], comment: o[7],
            machine: o[8], day: o[9]
        });
        n++;
    }
}

async function logHistory(orderId, action) {
    await add('history', {
        order_id: orderId,
        action: action,
        created_at: new Date().toLocaleString('ru-RU')
    });
}