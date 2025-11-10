// إعدادات عامة
const api = "https://api.alquran.cloud/v1"; // وثائق API الرسمية تشرح البُنى والمعرّفات
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

let curSurah = 1;
let curAyah = 1;
let ayahs = [];
let audioList = [];
let mediaRecorder, chunks = [];

// تحميل قائمة السور
async function loadSurahs() {
  const r = await fetch(`${api}/surah`);
  const j = await r.json();
  surahSel.innerHTML = j.data.map(s => `<option value="${s.number}">${s.number} - ${s.name}</option>`).join("");
  curSurah = Number(surahSel.value);
  await loadSurahData(curSurah);
}

// تحميل المقرئين الصوتيين المعتمدين
async function loadReciters() {
  const r = await fetch(`${api}/edition?format=audio`);
  const j = await r.json();
  const popular = ["ar.alafasy","ar.abdulbasitmurattal","ar.husary","ar.minshawi","ar.shaatree"];
  const list = j.data.filter(e => popular.includes(e.identifier));
  reciterSel.innerHTML = list.map(e => `<option value="${e.identifier}">${e.englishName}</option>`).join("");
}
 
// تحميل نصوص وآوديو السورة
async function loadSurahData(n) {
  const [arRes, trRes] = await Promise.all([
    fetch(`${api}/surah/${n}`), 
    fetch(`${api}/surah/${n}/en.transliteration`)
  ]);
  const ar = (await arRes.json()).data;
  const tr = (await trRes.json()).data;
  ayahs = ar.ayahs.map((a, i) => ({
    num: a.numberInSurah,
    text: a.text,
    translit: tr.ayahs[i]?.text || ""
  }));
  curAyah = 1;
  renderAyah();
  await loadAudio(n);
}

async function loadAudio(n) {
  const id = reciterSel.value || "ar.alafasy";
  const r = await fetch(`${api}/surah/${n}/${id}`);
  const j = await r.json();
  audioList = j.data.ayahs.map(x => x.audio);
  refAudio.src = audioList[curAyah - 1] || "";
}

function renderAyah(matchedIdx = []) {
  const words = ayahs[curAyah - 1].text.split(/\s+/);
  const html = words.map((w,i) => `<span class="${matchedIdx.includes(i) ? 'ok' : ''}">${w}</span>`).join(" ");
  ayahBox.innerHTML = html;
}

// مطابقة أولية للكلمات (تبسيط: إزالة التشكيل وتوحيد الألفات)
function normalize(s){
  return s.replace(/[\u064B-\u065F\u0670]/g,"")
          .replace(/[أإآا]/g,"ا").replace(/ى/g,"ي")
          .replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/ة/g,"ه").trim();
}
function match(transcript){
  const base = ayahs[curAyah-1].text.split(/\s+/).map(normalize);
  const tw = normalize(transcript).split(/\s+/);
  const ok = [];
  let j=0;
  for (let i=0; i<tw.length && j<base.length; i++){
    if (tw[i] === base[j]) { ok.push(j); j++; }
    else if (j+1<base.length && tw[i] === base[j+1]) { j++; ok.push(j); }
  }
  return ok;
}

// تشغيل آية مرجعية
playBtn.onclick = () => {
  refAudio.src = audioList[curAyah - 1] || "";
  refAudio.play();
};

// تسجيل تلاوة المتعلم
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
    };
    mediaRecorder.start(250);
    recBtn.disabled = true; stopBtn.disabled = false;
    addHint("بدأ التسجيل — حافظ على سرعة معتدلة ووضوح المخارج.");
  } catch(e){
    addHint("تعذر الوصول للميكروفون — تأكد من HTTPS والسماح في المتصفح.", true);
  }
};

stopBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state === "recording"){
    mediaRecorder.stop();
    recBtn.disabled = false; stopBtn.disabled = true;
  }
};

// تعرّف كلام مبدئي داخل المتصفح (عند الدعم) لإبراز الكلمات
let rec, canRec = false;
(function setupRecognition(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { addHint("التعرّف الصوتي غير مدعوم في هذا المتصفح — سيبقى التقييم يدويًا.", true); return; }
  rec = new SR(); rec.lang = "ar-SA"; rec.continuous = true; rec.interimResults = true; canRec = true;
  rec.onresult = (ev) => {
    for (let i=ev.resultIndex; i<ev.results.length; i++){
      const tr = ev.results[i][0].transcript;
      const m = match(tr);
      renderAyah(m);
    }
  };
})();

// عند تشغيل التسجيل، فعّل التعرف إن توفر
refAudio.addEventListener("play", ()=> {
  // توجيه للمستخدم فقط
});
recBtn.addEventListener("click", ()=> { if (canRec) rec.start(); });
stopBtn.addEventListener("click", ()=> { if (canRec) rec.stop(); });

// تغيير السورة/القارئ
surahSel.onchange = async (e) => { curSurah = Number(e.target.value); await loadSurahData(curSurah); };
reciterSel.onchange = async () => { await loadAudio(curSurah); };

// تلميحات تجويد مبدئية (قابلة للتوسعة لاحقًا)
function addHint(text, warn=false){
  const li = document.createElement("li");
  li.textContent = text;
  if (warn) li.style.color = "#b45309";
  hints.appendChild(li);
}

// بدء التشغيل
(async function init(){
  // تحميل السور
  await loadSurahs();
  // تحميل المقرئين
  await loadReciters();
  // إشارات تعليمية أولية
  addHint("قف على رؤوس الآي واظهر حركات آخر الكلمة عند الوقف والوصل.");
  addHint("طبّق الغنة في النون والميم المشددتين وراقب طول المدود بحس متّزن.");
})();
