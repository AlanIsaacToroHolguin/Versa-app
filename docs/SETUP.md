# VERSA — Puesta en marcha

Sitio estático (HTML/CSS/JS) + Supabase como backend. Sin paso de build: Vercel sirve los archivos tal cual.

## 1. Crear el proyecto en Supabase

1. Entra a https://supabase.com y crea un proyecto (región cercana, p. ej. São Paulo).
2. **SQL Editor → New query**: pega todo [supabase/migrations/001_initial_schema.sql](../supabase/migrations/001_initial_schema.sql) y pulsa **Run**.
   Crea tablas, reglas de verificación y las políticas de seguridad (RLS).
3. **Project Settings → API**: copia la **Project URL** y la **anon public key**.

## 2. Conectar el sitio

Edita [assets/js/core/config.js](../assets/js/core/config.js):

```js
url: 'https://xxxxxxxx.supabase.co',
anonKey: 'eyJ...',                 // la anon key (pública por diseño)
contactEmail: 'tu-correo@...'      // sale en las páginas de privacidad y términos
```

Nunca pongas la `service_role` key en el sitio.

## 3. Autenticación (Authentication → URL Configuration)

- **Site URL:** `https://versaapp-seven.vercel.app` (o tu dominio definitivo).
- **Redirect URLs:** agrega `https://versaapp-seven.vercel.app/**` y, para pruebas, `http://localhost:3000/**`.
- **Providers → Email:** déjalo activo. Mantén «Confirm email» encendido (evita cuentas con correos ajenos).
- Recomendado: en **Auth → Rate Limits** revisa los límites de envío de correo; el plan gratis es bajo.
  Para volumen real configura un SMTP propio (Authentication → SMTP Settings).

## 4. Probar en local

```bash
npx serve .          # o cualquier servidor estático
```

Flujo de prueba (necesitas dos cuentas, p. ej. un músico y un estudio):

1. Registra ambas cuentas y confirma los correos.
2. En «Mi cuenta» de cada una, activa **perfil público** y guarda.
3. Con el músico: «Mi trayectoria» → registra un trabajo buscando al estudio como contraparte.
4. Con el estudio: «Mi trayectoria» → aparece en «Por confirmar» → **Sí, fue así**.
5. Abre el perfil del músico: el trabajo sale con ✓ verificado.

## 5. Publicar

Haz commit y push a `main`; Vercel despliega solo.

## Cómo funciona la verificación

- El artista registra un trabajo y elige a la contraparte (otro perfil público de VERSA).
- El estado lo fija la base de datos, nunca el navegador: sin contraparte = `autodeclarado`; con contraparte = `pendiente`.
- Solo la contraparte puede pasarlo a `verificado` o `rechazado` (función `respond_work`).
- Un trabajo verificado no se puede editar; su dueño puede retirarlo.

## Pendientes antes del lanzamiento abierto

- Revisión de los textos de [legal/privacidad/](../legal/privacidad/index.html) y [legal/terminos/](../legal/terminos/index.html) por una persona con conocimiento legal (Ley 1581 de 2012). Son un borrador razonable, no asesoría jurídica.
- Colocar el enlace real de la encuesta en la sección «Participa» de [index.html](../index.html).
- Moderación: los reportes llegan a la tabla `reports` (se leen en Table Editor de Supabase).
- Dominio propio y, si crece el uso, SMTP propio.
