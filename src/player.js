// Sesli okuma mini oynatıcısı: HTML5 Audio, ayet ayet stream, otomatik ilerleme.
// Kur'an sekmesi ile Nazar bölümü ortak kullanır (tek kurulum, body'ye eklenir
// ki sekme değişse de görünür kalsın). Çalma listesi jenerik: { title, ayahs }.
import { wakeRef, wakeUnref } from './wakelock.js'

export function setupPlayer() {
  const player = document.createElement('div')
  player.id = 'quran-player'
  player.hidden = true
  player.innerHTML = `
    <div id="qp-info">
      <span id="qp-surah"></span>
      <span id="qp-ayah"></span>
    </div>
    <div id="qp-controls">
      <button type="button" id="qp-prev" aria-label="Önceki ayet">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 5v14L8 12zM7 5v14"/></svg>
      </button>
      <button type="button" id="qp-toggle" aria-label="Oynat / duraklat">
        <svg id="qp-play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>
        <svg id="qp-pause-icon" viewBox="0 0 24 24" aria-hidden="true" style="display:none"><path d="M7 5v14M17 5v14"/></svg>
      </button>
      <button type="button" id="qp-next" aria-label="Sonraki ayet">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14l9-7zM17 5v14"/></svg>
      </button>
      <button type="button" id="qp-close" aria-label="Kapat">×</button>
    </div>
  `
  document.body.appendChild(player)

  const audio = new Audio()
  audio.preload = 'auto'
  player.audioEl = audio // test/teşhis kancası (DOM dışı ses öğesine erişim)

  // playState: { title, ayahs, index, onIndex(index, auto), onStop() }
  // onIndex: çağıran taraf konum kaydı / kart vurgusu gibi kendi işlerini yapar.
  let playState = null
  let isPlaying = false

  function updateUi() {
    if (!playState) return
    const a = playState.ayahs[playState.index]
    player.querySelector('#qp-surah').textContent = playState.title
    player.querySelector('#qp-ayah').textContent = `Ayet ${a.no}`
    player.querySelector('#qp-play-icon').style.display = isPlaying ? 'none' : ''
    player.querySelector('#qp-pause-icon').style.display = isPlaying ? '' : 'none'
  }

  function showPlayer() {
    const tabs = document.querySelector('#tabs')
    if (tabs) player.style.bottom = `${Math.ceil(tabs.getBoundingClientRect().height)}px`
    player.hidden = false
  }

  function playIndex(index, auto = false) {
    if (!playState) return
    playState.index = index
    const a = playState.ayahs[index]
    isPlaying = true
    if (a.ses) {
      audio.src = a.ses
      audio.play().catch(() => {
        // otomatik oynatma engeli vb: duraklamış görün, akışı bozma
        isPlaying = false
        updateUi()
      })
    }
    showPlayer()
    updateUi()
    playState.onIndex?.(index, auto)
  }

  function stop() {
    audio.pause()
    audio.removeAttribute('src')
    const prev = playState
    playState = null
    isPlaying = false
    player.hidden = true
    prev?.onStop?.()
  }

  function advance(dir, auto = false) {
    if (!playState) return
    const next = playState.index + dir
    if (next < 0) return
    if (next >= playState.ayahs.length) {
      // liste bitti: oynatıcı kalır, durum duraklatılmış gösterilir
      audio.pause()
      isPlaying = false
      updateUi()
      return
    }
    playIndex(next, auto)
  }

  // Ardışık hata sınırı: çevrimdışı gibi tüm ayetlerin ses yüklemesi başarısız
  // olduğunda zincir liste sonuna kadar koşup kayıtlı konumu sürüklemesin
  let errorStreak = 0
  audio.addEventListener('ended', () => advance(1, true))
  audio.addEventListener('error', () => {
    if (!playState) return
    errorStreak++
    if (errorStreak >= 3) {
      isPlaying = false
      updateUi()
      return
    }
    // tek ayetin sesi yüklenemezse (ör. 404) akış durmaz, sonrakine geçilir
    advance(1, true)
  })
  audio.addEventListener('playing', () => {
    errorStreak = 0 // gerçek oynatma başladı; hata serisi sıfırlanır
  })
  // Sesli oynatma sırasında ekran uyanık kalsın (duraklatınca bırakılır)
  let audioLock = false
  audio.addEventListener('play', () => {
    isPlaying = true
    if (!audioLock) {
      audioLock = true
      wakeRef()
    }
    updateUi()
  })
  audio.addEventListener('pause', () => {
    isPlaying = false
    if (audioLock) {
      audioLock = false
      wakeUnref()
    }
    updateUi()
  })

  player.querySelector('#qp-toggle').addEventListener('click', () => {
    if (!playState) return
    errorStreak = 0 // kullanıcı eylemi: hata serisi baştan
    if (isPlaying) audio.pause()
    else audio.play().catch(() => {})
  })
  player.querySelector('#qp-prev').addEventListener('click', () => {
    errorStreak = 0
    advance(-1)
  })
  player.querySelector('#qp-next').addEventListener('click', () => {
    errorStreak = 0
    advance(1)
  })
  player.querySelector('#qp-close').addEventListener('click', stop)

  // Rotasyon/pencere değişiminde oynatıcı sekme barının üstünde kalsın
  window.addEventListener('resize', () => {
    if (!player.hidden) showPlayer()
  })

  return {
    // Yeni bir çalma listesi başlat; kullanıcı eylemiyle çağrılır
    play({ title, ayahs, index = 0, onIndex, onStop }) {
      errorStreak = 0
      // Sahipliği kaybeden önceki liste temizlik yapabilsin (bayat vurgu kalmasın);
      // önce durum değiştirilir ki onStop içindeki getState() yeni listeyi görsün
      const prev = playState
      playState = { title, ayahs, index, onIndex, onStop }
      if (prev && prev.ayahs !== ayahs) prev.onStop?.()
      playIndex(index)
    },
    stop,
    // Çalanı tanımak için: ayahs dizi KİMLİĞİ karşılaştırılır (memoize edilen
    // detay nesneleri oturum boyunca aynı referansta kalır)
    getState() {
      return playState ? { ayahs: playState.ayahs, index: playState.index } : null
    },
    // Geri tuşu deseni: oynatıcı görünürken ilk geri onu kapatır
    isOpen() {
      return !player.hidden
    },
  }
}
