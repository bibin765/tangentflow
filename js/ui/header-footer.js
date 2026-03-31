// ─── Header / Footer ────────────────────────────────────────────────
// State and UI wiring for the document header/footer settings.

export const headerFooter = {
  logoSrc: '',
  _logoImg: null,
  _logoW: 0,
  _logoH: 0,
  headerLeft: '',
  headerRight: '',
  footerLeft: '',
  footerRightMode: 'page-number',
  footerCustom: '',
}

/**
 * Wire up all header/footer event listeners.
 * @param {(id: string) => HTMLElement} $ — DOM selector helper (id => element)
 * @param {() => void} generatePreview
 */
export function initHeaderFooter($, generatePreview) {
  const hfLogoZone = $('hf-logo-zone')
  const hfLogoInput = $('hf-logo-input')

  hfLogoZone.addEventListener('click', () => hfLogoInput.click())
  hfLogoInput.addEventListener('change', () => {
    const file = hfLogoInput.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      headerFooter.logoSrc = reader.result
      const img = new Image()
      img.onload = () => {
        headerFooter._logoImg = img
        headerFooter._logoW = img.naturalWidth
        headerFooter._logoH = img.naturalHeight
        hfLogoZone.innerHTML = `<img src="${reader.result}" /><input type="file" id="hf-logo-input" accept="image/*" hidden />`
        hfLogoZone.querySelector('input').addEventListener('change', () => {
          hfLogoInput.dispatchEvent(new Event('change'))
        })
        generatePreview()
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })

  $('hf-header-left').addEventListener('input', e => { headerFooter.headerLeft = e.target.value; generatePreview() })
  $('hf-header-right').addEventListener('input', e => { headerFooter.headerRight = e.target.value; generatePreview() })
  $('hf-footer-left').addEventListener('input', e => { headerFooter.footerLeft = e.target.value; generatePreview() })
  $('hf-footer-right').addEventListener('change', e => {
    headerFooter.footerRightMode = e.target.value
    $('hf-footer-custom-wrap').style.display = e.target.value === 'custom' ? 'block' : 'none'
    generatePreview()
  })
  $('hf-footer-custom').addEventListener('input', e => { headerFooter.footerCustom = e.target.value; generatePreview() })
}
