/* =============================================================================
   NORTIQA — orquestación de la portada
   -----------------------------------------------------------------------------
   Precargador con progreso real, rail de capítulos, barra de estado y
   medición del propio sitio. Sin librerías, sin módulos ES (para que
   `file://` siga funcionando).
   ========================================================================== */

(function () {
  'use strict';

  var $  = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -----------------------------------------------------------------------
     1. Precargador
     El porcentaje sigue hitos reales: fuentes listas, shader compilado,
     primer cuadro dibujado. No es un temporizador disfrazado.
     ----------------------------------------------------------------------- */

  var precarga = $('#precarga');
  var pct      = $('#pct');
  var celdas   = $$('#precarga .precarga-grilla i');

  var meta = 0, mostrado = 0, cerrado = false;

  function hito(v) { meta = Math.max(meta, v); }

  function pintarProgreso() {
    if (cerrado) return;
    // Se acerca al hito alcanzado sin pasarlo, pero siempre avanza algo:
    // una aproximación puramente asintótica nunca llegaría a 100.
    mostrado = Math.min(meta, mostrado + Math.max((meta - mostrado) * 0.12, 0.7));
    var n = Math.min(100, Math.round(mostrado));
    if (pct) pct.textContent = n;

    // La grilla del isotipo se llena: ocho módulos en hueso, el noveno en oro.
    var llenas = Math.round((n / 100) * celdas.length);
    for (var i = 0; i < celdas.length; i++) {
      celdas[i].classList.toggle('on', i < llenas && i !== 5);
      celdas[i].classList.toggle('oro', i === 5 && llenas > 5);
    }

    if (n >= 100) { cerrar(); return; }
    requestAnimationFrame(pintarProgreso);
  }

  function cerrar() {
    if (cerrado) return;
    cerrado = true;
    if (pct) pct.textContent = '100';
    for (var i = 0; i < celdas.length; i++) {
      celdas[i].classList.toggle('on', i !== 5);
      celdas[i].classList.toggle('oro', i === 5);
    }
    setTimeout(function () {
      precarga.classList.add('fuera');
      setTimeout(function () { precarga.setAttribute('hidden', ''); }, 950);
    }, 320);
  }

  hito(12);
  requestAnimationFrame(pintarProgreso);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { hito(38); });
  } else {
    hito(38);
  }

  // Red de seguridad: si algo falla, la página nunca queda tapada.
  setTimeout(function () { hito(100); }, 6000);

  /* -----------------------------------------------------------------------
     2. La escena
     ----------------------------------------------------------------------- */

  var lienzo = $('#escena');
  var escena = null;

  if (lienzo && typeof window.montarEscena === 'function') {
    escena = window.montarEscena(lienzo, function (ok) {
      if (!ok) { document.body.classList.add('sin-webgl'); hito(100); return; }
      hito(100);                       // primer cuadro dibujado
    });
    if (escena) hito(72);              // shader compilado y enlazado
  } else {
    document.body.classList.add('sin-webgl');
    hito(100);
  }

  /* -----------------------------------------------------------------------
     3. Rail de capítulos y desvanecido de la escena
     Scroll nativo: nada de secuestrar la rueda. El rail refleja dónde
     estás, no decide por vos.
     ----------------------------------------------------------------------- */

  var enlaces  = $$('#capitulos a');
  var secciones = enlaces
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  function marcar(id) {
    enlaces.forEach(function (a) {
      a.setAttribute('aria-current', a.getAttribute('href') === '#' + id ? 'true' : 'false');
    });
  }

  /* -----------------------------------------------------------------------
     Tono del cromo fijo
     El encabezado, el rail y la barra de estado no heredan los tokens del
     capítulo porque son `fixed`. Hay que decirles sobre qué están.

     Y NO sirve el capítulo "actual" del rail: ese lo decide un
     `IntersectionObserver` con un margen de -45%, o sea que ya marca Enfoque
     mientras todavía se ve el hero. El encabezado quedaba en vidrio CLARO
     sobre el hero OSCURO. Son dos preguntas distintas: "¿en qué capítulo
     estoy?" y "¿qué tengo detrás?".

     Se resuelve por geometría, que es exacta: qué sección cruza el borde de
     abajo del encabezado, y qué sección cruza el medio del viewport.
     ----------------------------------------------------------------------- */

  function seccionEn(y) {
    for (var i = 0; i < secciones.length; i++) {
      var r = secciones[i].getBoundingClientRect();
      if (r.top <= y && r.bottom > y) return secciones[i];
    }
    return null;
  }

  function tonoDe(sec) {
    return sec && /cap--claro/.test(sec.className) ? 'claro' : 'oscuro';
  }

  var cabecera = document.querySelector('body > header');
  var barra = document.getElementById('estado');

  // Cada pieza fija pregunta por lo que tiene DETRÁS, y cada una está en otro
  // lado: el encabezado arriba, el rail a lo alto, la barra abajo. Con una sola
  // respuesta para las tres, alguna queda con el tono equivocado.
  function pintarTono() {
    var b = document.body;
    var altoCab = cabecera ? cabecera.offsetHeight : 80;
    var altoBarra = barra ? barra.offsetHeight : 41;
    b.setAttribute('data-tono-cab',   tonoDe(seccionEn(altoCab + 4)));
    b.setAttribute('data-tono-rail',  tonoDe(seccionEn(innerHeight / 2)));
    b.setAttribute('data-tono-barra', tonoDe(seccionEn(innerHeight - altoBarra - 4)));
  }

  if ('IntersectionObserver' in window && secciones.length) {
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) { if (e.isIntersecting) marcar(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    secciones.forEach(function (s) { obs.observe(s); });
  }

  var hero = $('#hero');
  var ticking = false;

  function alDesplazar() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;

      pintarTono();

      var h = hero ? (hero.offsetHeight || innerHeight) : innerHeight;

      // El vidrio del encabezado y del rail se enciende al dejar el hero. No es
      // solo estética: `backdrop-filter` encima de la escena 3D desenfocaría un
      // canvas vivo en cada cuadro. En las páginas sin hero, apenas se scrollea.
      document.body.classList.toggle('fuera-hero',
        hero ? scrollY > h * 0.6 : scrollY > 24);
      // La atenuación arranca recién pasado el 30% del hero: un scroll corto
      // no puede apagar la escena. Sin hero —páginas interiores— se da por
      // salido: la escena no tiene dónde vivir.
      var v = hero ? Math.min(1, Math.max(0, (scrollY - h * 0.30) / (h * 0.60))) : 1;
      var dentro = hero && scrollY <= h * 1.25;

      if (escena) {
        escena.setScroll(v);
        // Fuera del hero la escena no se dibuja: no se gasta GPU de fondo.
        escena.pausar(!dentro);
      }
    });
  }

  addEventListener('scroll', alDesplazar, { passive: true });

  // Y una vez al inicio: si la página carga ya desplazada —con un ancla en la
  // URL, o con la posición restaurada por el navegador— el evento de scroll no
  // llega nunca y la escena no se atenuaría.
  alDesplazar();
  addEventListener('load', alDesplazar);

  /* -----------------------------------------------------------------------
     4. Barra de estado
     ----------------------------------------------------------------------- */

  var eFps  = $('#e-fps');
  var eFoco = $('#e-foco');

  if (escena && !reduce) {
    setInterval(function () {
      if (document.hidden) return;
      if (eFps)  eFps.textContent  = escena.dps ? escena.dps : '—';
      if (eFoco) eFoco.textContent = ('0' + (escena.foco + 1)).slice(-2);
    }, 500);
  } else if (escena) {
    if (eFps)  eFps.textContent  = '0';
    if (eFoco) eFoco.textContent = ('0' + (escena.foco + 1)).slice(-2);
  }

  /* -----------------------------------------------------------------------
     5. Medición del propio sitio
     ----------------------------------------------------------------------- */

  function medir() {
    var set = function (id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; };

    var nav = performance.getEntriesByType('navigation')[0];
    if (nav) set('m-carga', Math.max(1, Math.round(nav.domContentLoadedEventEnd)) + ' ms');

    set('m-nodos', document.getElementsByTagName('*').length.toLocaleString('es-AR'));
    set('m-deps', '0');

    // Peso propio, todo incluido. Antes se descontaba la tipografía porque
    // venía de Google; ahora viaja con el sitio, así que cuenta.
    var recursos = performance.getEntriesByType('resource');
    var red = recursos.reduce(function (n, r) { return n + (r.encodedBodySize || r.decodedBodySize || 0); }, 0);
    var doc = new Blob([document.documentElement.outerHTML]).size;

    if (red) {
      set('m-peso', ((red + doc) / 1024).toFixed(0) + ' KB');
    } else {
      // Con file:// el navegador no informa bytes: los medimos nosotros.
      Promise.all(['styles.css', 'app.js', 'scene.js', 'haz.js', 'marcas.js',
                   'assets/fuentes/hanken-grotesk-latin.woff2',
                   'assets/fuentes/hanken-grotesk-latin-ext.woff2'].map(function (f) {
        return fetch(f).then(function (r) { return r.blob(); })
                       .then(function (b) { return b.size; })
                       .catch(function () { return 0; });
      })).then(function (tam) {
        var suma = tam.reduce(function (a, b) { return a + b; }, doc);
        set('m-peso', (suma / 1024).toFixed(0) + ' KB');
      }).catch(function () { set('m-peso', (doc / 1024).toFixed(0) + ' KB'); });
    }
  }

  if (document.readyState === 'complete') setTimeout(medir, 0);
  else addEventListener('load', function () { setTimeout(medir, 0); });
})();
