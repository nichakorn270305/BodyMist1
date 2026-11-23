/* =========================================================
   Body Scent — script.js
   ใช้ร่วมกันทุกหน้า: ตรวจจาก id ของ element ว่าอยู่หน้าไหน
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   ========================================================= */
(function () {
  'use strict';

  var ORDER_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx8GhWCj5CS9zyZXsJ9HWvav0j2Q7sAojKh2IpcpeqiLbMPpG_ezHQ9tloifwTlP9h09w/exec';
  var ORDERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTFLulIjwDFeNXHADDSch4tSkcYJ6V_UVE75Rp2W-xPl5HbioR3K0P_BT61AePvUDZrZJx7ydqqruxn/pub?gid=0&single=true&output=csv';

  var MOODS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'fresh', label: 'Fresh' },
    { key: 'sweet', label: 'Sweet' },
    { key: 'confident', label: 'Confident' },
    { key: 'romance', label: 'Romance' }
  ];

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (byId('product-list')) initProductPage();
    if (byId('orderForm')) initOrderPage();
    if (document.querySelector('#ordersTable tbody')) initAdminPage();
  });

  /* ---------------------------------------------------------
     1) product.html — โหลดสินค้า + ปุ่มกรอง mood
     --------------------------------------------------------- */
  function initProductPage() {
    var listEl = byId('product-list');
    var barEl = byId('filter-bar');
    var products = [];

    // ?mood=xxx → กรองอัตโนมัติตอนโหลดหน้า
    var requested = (new URLSearchParams(window.location.search).get('mood') || 'all').toLowerCase();
    var current = MOODS.some(function (m) { return m.key === requested; }) ? requested : 'all';

    function moodLabel(key) {
      var found = MOODS.filter(function (m) { return m.key === key; })[0];
      return found ? found.label : key;
    }

    function renderBar() {
      if (!barEl) return;
      barEl.innerHTML = '';
      MOODS.forEach(function (m) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-btn' + (m.key === current ? ' active' : '');
        btn.setAttribute('data-filter', m.key);
        btn.textContent = m.label;
        btn.addEventListener('click', function () {
          current = m.key;
          renderBar();
          renderList();
        });
        barEl.appendChild(btn);
      });
    }

    function renderList() {
      var shown = products.filter(function (p) {
        return current === 'all' || p.mood === current;
      });

      if (!shown.length) {
        listEl.innerHTML = '<p class="text-center">ไม่พบสินค้าในหมวดนี้</p>';
        return;
      }

      listEl.innerHTML = shown.map(function (p) {
        var sizeText = p.size || (p.type === 'rollon' ? 'Roll-on' : '');
        var orderUrl = 'order.html?item=' + encodeURIComponent(p.name) +
                       '&price=' + encodeURIComponent(p.price);
        return (
          '<article class="product-card" data-mood="' + escapeHtml(p.mood) + '">' +
            '<div class="product-card__image">' +
              '<img src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.name) + '" loading="lazy">' +
            '</div>' +
            '<div class="product-card__body">' +
              '<span class="mood-label">' + escapeHtml(moodLabel(p.mood)) + '</span>' +
              '<span class="mood-line"></span>' +
              '<h3 class="product-card__name">' + escapeHtml(p.name) + '</h3>' +
              '<div class="product-card__meta">' +
                '<span class="product-card__size">' + escapeHtml(sizeText) + '</span>' +
                '<span class="price">' + escapeHtml(Number(p.price).toLocaleString('th-TH')) + '<small>บาท</small></span>' +
              '</div>' +
              '<a class="btn btn--block" href="' + orderUrl + '">สั่งซื้อ</a>' +
            '</div>' +
          '</article>'
        );
      }).join('');
    }

    renderBar();
    listEl.innerHTML = '<p class="text-center">กำลังโหลดสินค้า...</p>';

    fetch('products.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        renderList();
      })
      .catch(function (error) {
        console.error(error);
        listEl.innerHTML = '<p class="text-center">ไม่สามารถโหลดสินค้าได้ กรุณาลองใหม่อีกครั้ง</p>';
      });
  }

  /* ---------------------------------------------------------
     2) order.html — เติม items/total จาก URL + ส่งออเดอร์
     --------------------------------------------------------- */
  function initOrderPage() {
    var form = byId('orderForm');
    var itemsEl = byId('items');
    var totalEl = byId('total');

    // อ่าน ?item=...&price=... แล้วเติมลงฟอร์มทันที (ทั้ง items และ total)
    var params = new URLSearchParams(window.location.search);
    var item = params.get('item');
    var price = params.get('price');
    if (itemsEl && item !== null) itemsEl.value = item;
    if (totalEl && price !== null) totalEl.value = price;

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      var payload = {
        customerName: byId('customerName').value.trim(),
        contact: byId('contact').value.trim(),
        items: byId('items').value.trim(),
        total: byId('total').value.trim(),
        note: byId('note') ? byId('note').value.trim() : ''
      };

      fetch(ORDER_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      .then(function () { window.location.href = 'thankyou.html'; })
      .catch(function (error) {
        console.error(error);
        if (submitBtn) submitBtn.disabled = false;
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      });
    });
  }

  /* ---------------------------------------------------------
     3) admin.html — อ่าน CSV จาก Google Sheet มาแสดงเป็นตาราง
     --------------------------------------------------------- */

  // parse CSV เอง: รองรับ "ข้อความมี, จุลภาค", "" แทน " และขึ้นบรรทัดใหม่ใน quote
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }

    // แถวสุดท้าย (กรณีไฟล์ไม่ลงท้ายด้วยขึ้นบรรทัดใหม่)
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }

    // ตัดแถวว่างทิ้ง
    return rows.filter(function (r) {
      return r.some(function (cell) { return cell.trim() !== ''; });
    });
  }

  function initAdminPage() {
    var tbody = document.querySelector('#ordersTable tbody');
    var COLS = 6;

    function showMessage(msg) {
      tbody.innerHTML = '';
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = COLS;
      td.style.textAlign = 'center';
      td.textContent = msg;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showMessage('กำลังโหลดข้อมูล...');

    fetch(ORDERS_CSV_URL, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);

        // ถ้าแถวแรกเป็นหัวตาราง (ช่องแรกไม่มีตัวเลขเลย เช่น "วันเวลา") ให้ข้าม
        // ถ้าแถวแรกเป็นวันที่จริง (มีตัวเลข) จะไม่ถูกข้าม
        if (rows.length && !/\d/.test(rows[0][0] || '')) rows.shift();

        if (!rows.length) {
          showMessage('ยังไม่มีรายการสั่งซื้อ');
          return;
        }

        // ข้อมูลถูกต่อท้ายตามลำดับเวลา → กลับด้านให้ล่าสุดขึ้นก่อน
        rows.reverse();

        tbody.innerHTML = '';
        rows.forEach(function (r) {
          var tr = document.createElement('tr');
          for (var c = 0; c < COLS; c++) {
            var td = document.createElement('td');
            td.textContent = r[c] || '';   // textContent กัน HTML แปลกปลอมจากฟอร์มลูกค้า
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        showMessage('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      });
  }
})();
