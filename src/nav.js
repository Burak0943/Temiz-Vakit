// Telefon geri tuşu yönetimi (History API): her görünüm/alt-görünüm geçişi
// history'ye yazılır; geri tuşu uygulamadan atmak yerine uygulama İÇİNDE
// geri gider. Kök durumda çift-geri çıkış deseni (2 sn'lik ipucu çubuğu).
//
// Yığın düzeni: [önceki sayfa..., KÖK İŞARETİ, uygulama durumları...]
// Kök işareti sayfanın açılış girdisinin üzerine replaceState ile yazılır;
// işarete düşen popstate "kökte geri basıldı" demektir.
export function setupNav({ getState, apply, isPlayerOpen, closePlayer, showExitHint }) {
  const SID = Math.random().toString(36).slice(2) // oturum kimliği: bayat girdiler ayıklanır
  let current = null
  let applying = false // popstate uygularken modüllerin bildirimleri push üretmesin
  let exitTimer = null

  function stamped(state) {
    return { ...state, sid: SID }
  }

  function atOwnMarker() {
    return history.state?.tvMarker === true && history.state.sid === SID
  }

  function push() {
    if (applying) return
    // Çıkış penceresinde (işaretin üstünde) gezinme: önce koruma girdisi geri
    // konur ki geri zinciri kök durumu atlamasın
    if (atOwnMarker() && current) history.pushState(current, '')
    const next = stamped(getState())
    // Aynı duruma ardışık push yok: yığın şişmez
    if (current && JSON.stringify(next) === JSON.stringify(current)) return
    history.pushState(next, '')
    current = next
  }

  window.addEventListener('popstate', (e) => {
    const st = e.state
    // 1) Oynatıcı açıksa ilk geri onu kapatır; gezinme iptal edilir
    if (isPlayerOpen()) {
      closePlayer()
      history.pushState(current, '')
      return
    }
    // 2) Kök işareti: çift-geri çıkış. Koruma girdisi hemen GERİ KONMAZ —
    // taze kurulu PWA'da işaret oturumun 0. girdisidir; script history.back()
    // orada no-op olur, ama girdi altta kaldığı sürece İKİNCİ sistem-geri'si
    // uygulamayı kapatır (tarayıcı sekmesinde önceki sayfaya gider). 2 sn
    // içinde ikinci basış gelmezse koruma zamanlayıcıyla geri konur.
    if (st?.tvMarker) {
      if (st.sid !== SID) {
        history.back() // eski oturum kalıntısı: üstünden atla
        return
      }
      showExitHint()
      clearTimeout(exitTimer)
      exitTimer = setTimeout(() => {
        // Kullanıcı bu arada gezinmediyse hâlâ işaretteyiz: korumayı geri koy
        if (atOwnMarker() && current) history.pushState(current, '')
      }, 2000)
      return
    }
    // 3) Bu oturumun uygulama durumu: görünümü geri yükle
    if (st?.sid === SID && st.view) {
      applying = true
      try {
        apply(st)
      } finally {
        applying = false
      }
      current = st
      return
    }
    // 4) Eski oturumdan kalan uygulama girdisi (yenileme sonrası): üstünden atla
    if (st && st.view) history.back()
  })

  return {
    push,
    init() {
      history.replaceState({ tvMarker: true, sid: SID }, '')
      current = stamped(getState())
      history.pushState(current, '')
    },
  }
}
