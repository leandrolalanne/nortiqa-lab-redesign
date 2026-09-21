/* Formulario de contacto.
 *
 * Script clásico, sin módulos: el sitio abre con `file://` y ahí los imports
 * ES quedan bloqueados por CORS. Misma razón que el resto de `assets/js/`.
 *
 * ESTADO: la estructura está armada pero el formulario NO envía. El destino
 * vive en `data-destino` del <form> y arranca vacío, porque todavía no hay
 * casilla: `hola@nortiqalab.com` no tiene MX y el correo rebota. Un
 * formulario que acepta envíos sin tener a dónde entregarlos pierde consultas
 * en silencio, así que sin destino se queda inerte y muestra el correo.
 *
 * PARA ACTIVARLO, cuando Google Workspace esté andando y exista el webhook:
 * poner la URL en `data-destino` del formulario, en index.html. Nada más.
 *
 * Lo que este archivo NO hace, a propósito: validar de verdad. Todo lo de acá
 * es cortesía para quien completa —se saltea con las herramientas del
 * navegador en diez segundos—. Las defensas que cuentan (límite de tasa,
 * saneo de CR/LF antes de tocar cabeceras de correo, topes de tamaño) van en
 * el servidor. Acá solo se filtra el ruido barato.
 */
(function () {
  'use strict';

  var form = document.getElementById('form-contacto');
  if (!form) return;

  var estado  = form.querySelector('.form-estado');
  var enviar  = form.querySelector('.form-enviar');
  var trampa  = form.querySelector('.form-trampa input');
  var destino = (form.getAttribute('data-destino') || '').trim();

  /* Cuánto tarda un humano en completar esto. Por debajo, es un bot: los
     automatizados envían en el mismo tick en que cargan la página. El umbral
     es deliberadamente bajo —quien tipea rápido tarda más que esto igual— y
     se mide desde que el script corre, no desde el primer foco. */
  var MINIMO_MS = 3000;
  var cargado = Date.now();

  function decir(texto, tono) {
    if (!estado) return;
    estado.textContent = texto;
    if (tono) estado.setAttribute('data-tono', tono);
    else estado.removeAttribute('data-tono');
  }

  /* Sin destino el formulario queda inerte, pero LEGIBLE: los campos se ven y
     se pueden leer; lo que no se puede es mandar al vacío. */
  if (!destino) {
    form.addEventListener('submit', function (ev) { ev.preventDefault(); });
    if (enviar) enviar.disabled = true;
    decir('El formulario todavía no está activo. Escribinos a hola@nortiqalab.com.');
    return;
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();

    /* La trampa primero: si vino llena, es un bot. No se le avisa —un mensaje
       de error le enseña a esquivarla— y se finge éxito. */
    if (trampa && trampa.value !== '') {
      decir('Gracias, te vamos a responder.', 'bien');
      form.reset();
      return;
    }

    if (Date.now() - cargado < MINIMO_MS) {
      decir('Gracias, te vamos a responder.', 'bien');
      form.reset();
      return;
    }

    /* `novalidate` apaga los globos del navegador para que el mensaje salga
       por `.form-estado`, que el lector de pantalla sí anuncia. La validez la
       sigue calculando el navegador; sólo cambia quién la comunica. */
    if (!form.checkValidity()) {
      decir('Revisá los campos marcados: falta completar algo.', 'error');
      var primero = form.querySelector(':invalid');
      if (primero) primero.focus();
      return;
    }

    var datos = {};
    ['nombre', 'correo', 'organizacion', 'mensaje'].forEach(function (campo) {
      var el = form.elements[campo];
      if (el) datos[campo] = el.value.trim();
    });
    datos.origen = location.href;

    if (enviar) enviar.disabled = true;
    decir('Enviando…');

    fetch(destino, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        form.reset();
        cargado = Date.now();
        decir('Listo. Te vamos a responder a la brevedad.', 'bien');
      })
      .catch(function () {
        /* No se detalla el error: a quien completa no le sirve un código
           HTTP, y el camino alternativo tiene que quedar a mano. */
        decir('No pudimos enviarlo. Escribinos a hola@nortiqalab.com.', 'error');
      })
      .then(function () {
        if (enviar) enviar.disabled = false;
      });
  });
})();
