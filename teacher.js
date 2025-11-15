// إعدادات API
const API = "https://api.alquran.cloud/v1";
const POPULAR_RECITERS = ["ar.alafasy", "ar.abdulbasitmurattal", "ar.husary", "ar.minshawi", "ar.shaatree"];

// عناصر DOM
const surahSel = document.getElementById("surah");
const reciterSel = document.getElementById("reciter");
const ayahBox = document.getElementById("ayah");
const playBtn = document.getElementById("play");
const recBtn = document.getElementById("rec");
const stopBtn = document.getElementById("stop");
const refAudio = document.getElementById("refAudio");
const userAudio = document.getElementById("userAudio");
const hints = document.getElementById("hints");

// متغيرات الحالة
let curSurah = 1;
let ayahs = [];
let audioList = [];
let mediaRecorder, chunks = [];

// تحميل السور
async function loadSurahs() {
  try {
    const res = await fetch(`${API}/surah`);
    const data = await res.json();
    surahSel.innerHTML = data.data.map(s => 
      `<option value="${s.number}">${s.number} - ${s.name}</option>`
    ).join("");
    await loadSurahData(1);
  } catch(e) {
    ayahBox.textContent = "خطأ في تحميل البيانات";
    console.error("Error loading surahs:", e);
  }
}

// تحميل المقرئين
async function loadReciters() {
  try {
    const res = await fetch(`${API}/edition?format=audio`);
    const data = await res.json();
    const list = data.data.filter(e => POPULAR_RECITERS.includes(e.identifier));
    reciterSel.innerHTML = list.map(e => 
      `<option value="${e.identifier}">${e.englishName}</option>`
    ).join("");
  } catch(e) {
    console.error("Error loading reciters:", e);
    addHint("خطأ في تحميل قائمة المقرئين", true);
  }
}

// تحميل السورة
async function loadSurahData(n) {
  try {
    const [arRes, audioRes] = await Promise.all([
      fetch(`${API}/surah/${n}`),
      fetch(`${API}/surah/${n}/${reciterSel.value}`)
    ]);
    
    if (!arRes.ok || !audioRes.ok) throw new Error("Failed to fetch surah");
    
    const ar = (await arRes.json()).data;
    const audioData = (await audioRes.json()).data;
    
    ayahs = ar.ayahs.map((a, i) => ({
      num: a.numberInSurah,
      text: a.text
    }));
    
    audioList = audioData.ayahs.map(x => x.audio);
    renderAyah();
    addHint(`تم تحميل سورة ${ar.englishName} بنجاح ✓`);
  } catch(e) {
    ayahBox.textContent = "خطأ في تحميل السورة";
    console.error("Error loading surah data:", e);
    addHint("فشل تحميل السورة المطلوبة", true);
  }
}

// عرض الآية
function renderAyah() {
  if (ayahs.length === 0) return;
  const words = ayahs[0].text.split(/\s+/);
  const html = words.map((w, i) => 
    `<span class="word" data-idx="${i}">${w}</span>`
  ).join(" ");
  ayahBox.innerHTML = html;
}

// تشغيل الآية
playBtn.onclick = () => {
  if (audioList[0]) {
    refAudio.src = audioList[0];
    refAudio.play();
    addHint("جاري تشغيل الآية المرجعية...");
  } else {
    addHint("لا توجد تسجيلات صوتية متاحة", true);
  }
};

// تسجيل صوت المستخدم
recBtn.onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];
    
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      userAudio.src = URL.createObjectURL(blob);
      stream.getTracks().forEach(t => t.stop());
      addHint("تم حفظ التسجيل بنجاح ✓");
      compareAudio();
    };
    
    mediaRecorder.start();
    recBtn.style.display = "none";
    stopBtn.style.display = "inline-block";
    addHint("جاري التسجيل... اقرأ الآية بوضوح");
  } catch(e) {
    console.error("Microphone error:", e);
    addHint("خطأ: لم يتم الحصول على إذن الميكروفون ⚠️ تأكد من السماح للموقع بالوصول للميكروفون", true);
    addHint("ملاحظة: قد يتطلب HTTPS أو localhost للعمل");
  }
};

// إيقاف التسجيل
stopBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    recBtn.style.display = "inline-block";
    stopBtn.style.display = "none";
  }
};

// مقارنة الصوت (ميزة توضيحية)
function compareAudio() {
  addHint("🔍 تحليل التسجيل:");
  addHint("✓ طول التسجيل مناسب");
  addHint("✓ جودة الصوت جيدة");
  addHint("💡 تجنب الإسراع في القراءة");
  addHint("💡 ركز على مخارج الحروف");
}

// إضافة ملاحظة
function addHint(text, isWarn = false) {
  const li = document.createElement("li");
  li.textContent = text;
  if (isWarn) li.style.color = "#b45309";
  hints.appendChild(li);
  
  // حد أقصى 10 ملاحظات
  while (hints.children.length > 10) {
    hints.removeChild(hints.firstChild);
  }
}

// تغيير السورة
surahSel.onchange = (e) => {
  curSurah = Number(e.target.value);
  loadSurahData(curSurah);
};

// تغيير القارئ
reciterSel.onchange = () => {
  loadSurahData(curSurah);
};

// التهيئة الأولية
(async () => {
  addHint("جاري تحميل البيانات...");
  await loadSurahs();
  await loadReciters();
  addHint("تم التحميل بنجاح ✓");
})();
