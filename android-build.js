// Este arquivo só tem conteúdo real DENTRO do .apk Android — o workflow de
// build (.github/workflows/build-android-apk.yml) sobrescreve a cópia dele
// em www/ com o identificador do commit compilado, antes de empacotar.
// No site normal (main, GitHub Pages) fica com este valor neutro — sem
// isso, o <script src="android-build.js"> do index.html daria 404 (não
// quebra nada, mas suja o console à toa).
window.FORTHEMP_ANDROID_BUILD = null;
