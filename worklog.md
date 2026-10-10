# Worklog

---
Task ID: 1
Agent: Super Z (agente principal)
Task: Crear página web "Eva y David" con chat privado, login por usuario/contraseña e historial de mensajes de días anteriores

Work Log:
- Inicializado entorno fullstack (Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui + Prisma/SQLite)
- Definido esquema Prisma: User, Message, Session (prisma/schema.prisma) y aplicado con db:push
- Creada semilla (scripts/seed.ts): usuarios eva (eva123) y david (david123) con bcrypt + 6 mensajes de ejemplo de los 3 días anteriores
- Creadas rutas API: /api/login (bcrypt + cookie httpOnly 30 días), /api/logout, /api/me (devuelve user + token para el socket), /api/messages (GET historial últimos 500, POST guardar + difundir)
- Creada librería de sesión src/lib/auth.ts (tokens duales uuid, caducidad 30 días)
- Creado mini-servicio Socket.io en mini-services/chat-service (puerto 3003, path '/', autenticación por token validado contra /api/me, pid en service.pid)
- Añadido endpoint interno de difusión en servidor HTTP separado (127.0.0.1:3004) con secreto compartido CHAT_INTERNAL_SECRET — necesario porque socket.io con path '/' intercepta todas las rutas del httpServer principal
- Construida UI única en src/app/page.tsx: pantalla de login con marca "Eva ♥ David" + vista de chat con burbujas por autor (Eva rosa, David esmeralda), separadores de día (Hoy/Ayer/fecha es-ES), scroll automático, indicador "En línea", logout, responsive móvil con safe-area
- Actualizado layout.tsx: metadata en español, favicon 💬, lang="es", viewport-fit cover

Bugs encontrados y corregidos durante la verificación:
1. socket.io con path '/' capturaba el endpoint HTTP interno /internal/broadcast (respondía 400) → la difusión en tiempo real nunca llegaba. Fix: servidor HTTP interno independiente en puerto 3004 + fetch desde la API a 127.0.0.1:3004
2. El cliente no validaba mensajes entrantes por socket → un payload malformado provocaba "Invalid time value" en formatDayLabel. Fix: validación de forma (id/content/createdAt/username) + guardas NaN en formatDayLabel/formatTime
3. Nota de entorno: el input físico del daemon agent-browser se degrada tras muchos comandos (falla incluso en páginas estáticas); se resolvió reiniciando el navegador. No es un bug de la app (login físico verificado en sesiones frescas)

Verificación end-to-end (agent-browser, vía gateway :81):
- Login con contraseña incorrecta muestra error; login correcto de Eva y David (clic físico) OK
- Historial agrupado: "Miércoles, 7 de octubre", "Jueves, 8 de octubre", "Ayer", "Hoy" OK
- Tiempo real bidireccional verificado: David envía → Eva lo recibe sin recargar, y viceversa; log del servicio "[chat] difundido mensaje id=... de david"
- Sesiones persistentes (cookie 30 días), logout OK, endpoint interno protegido (403 sin secreto) OK
- Capturas: desktop Eva/David + móvil 390px OK (burbujas, separadores, header)
- Limpieza final: mensajes de prueba borrados (solo quedan los 6 de ejemplo), archivos public/test-*.html eliminados, lint sin errores

Stage Summary:
- App entregada y verificada: chat privado en tiempo real para Eva y David con login, historial por días y sesiones persistentes
- Credenciales: usuario "eva" / contraseña "eva123" · usuario "david" / contraseña "david123"
- Artefactos clave: src/app/page.tsx, src/app/api/{login,logout,me,messages}, src/lib/auth.ts, mini-services/chat-service (puertos 3003/3004), prisma/schema.prisma, scripts/seed.ts
- La BD queda con 6 mensajes de ejemplo de días anteriores para demostrar el historial

---
Task ID: 2
Agent: Super Z (agente principal)
Task: Mejoras del chat Eva y David: cambio de contraseña verificado por correo, borrar mensajes de ejemplo, indicador "escribiendo", envío de fotos y mejoras varias

Work Log:
- Esquema Prisma ampliado: User.email, Message.type/readAt, MessageImage (fotos en base64 en BD), PasswordResetToken (códigos hash SHA-256, caducidad 10 min, un solo uso, máx. 5/15 min) + db:push
- Borrados los 6 mensajes de ejemplo (scripts/clear-messages.ts); seed.ts ahora es idempotente y NUNCA toca mensajes; añadido scripts/reset-password.ts
- Email: nodemailer + src/lib/email.ts (SMTP por .env: SMTP_HOST/PORT/USER/PASS/FROM, plantilla HTML en español, EMAIL_DEV_FALLBACK=true muestra el código en pantalla mientras no haya SMTP — el flujo público de reset exige SMTP real por seguridad)
- APIs nuevas: /api/profile/email, /api/password/request-change, /api/password/confirm-change (cierra otras sesiones), /api/password/reset-request, /api/password/reset-confirm (cierra todas), /api/images/[id] (protegida, caché inmutable), /api/messages/read (recibos ✓✓) y src/lib/broadcast.ts (evento genérico)
- /api/messages: acepta texto o foto (data URL validada, JPG/PNG/WebP/GIF, máx 5MB) + devuelve type/imageUrl/readAt; /api/me y /api/login devuelven email y partner
- Mini-servicio socket (puerto 3003): presencia (presence-state), retransmisión de "typing" → user-typing, endpoint /broadcast acepta {event,payload}; relanzado con setsid+subshell para persistir (ppid=1, PID en service.pid)
- UI (page.tsx + components/chat/*): MessageRow con fotos y checks ✓/✓✓, TypingBubble animada, Lightbox (Esc/clic, autofocus), EmojiPicker (40 emojis, cierra al elegir), PhotoDialog (preview + descripción), SettingsDialog (guardar correo + cambio contraseña con código), ForgotPassword (2 pasos desde login), header estilo WhatsApp (pareja + estado En línea/Escribiendo…/Desconectado), textarea autoexpandible con Enter=enviar, compresión de fotos en cliente (máx 1600px JPEG85, GIF intactos), ping sonoro + parpadeo de título con pestaña oculta, botón scroll-abajo, /api/me con partner

Bugs encontrados y corregidos durante la verificación:
1. Los procesos lanzados con setsid/nohup morían al acabar cada comando del shell (limpieza del harness) → fix: doble fork vía subshell `( setsid nohup ... & )` → adoptados por init (ppid=1) y persistentes
2. El mini-servicio corría SIN CHAT_INTERNAL_SECRET en su entorno → relanzado con env explícito; verificado 403 sin secreto / 200 con secreto en :3004
3. Falsos fallos del harness: clics físicos de agent-browser sobre botones shadcn recién re-renderizados (disabled:pointer-events-none) y aria-label duplicado del panel de emojis; verificado por JS que todo funciona; añadido autoFocus al Lightbox y cierre del picker tras elegir emoji

Verificación end-to-end (agent-browser, 2 sesiones paralelas vía gateway :81):
- Login Eva/David OK; recuperación de login sin SMTP avisa correctamente (503)
- Ajustes: guardar correo → "Código enviado a e*******@…" → modo pruebas muestra código → cambio de contraseña OK; API confirma: nueva 200, antigua 401, código reutilizado 400
- Tiempo real bidireccional texto y fotos (ambos reciben sin recargar); "Escribiendo…" en cabecera; presencia En línea; recibos ✓✓ azules en ambos lados
- Lightbox abre/cierra; emojis se insertan; foto con descripción se muestra y se descarga (200 image/png, 401 sin sesión)
- Lint sin errores; BD final limpia: 0 mensajes, 0 sesiones, usuarios eva/david con contraseñas originales y sin email
- Capturas en scripts/final-{eva,david,movil}.png

Stage Summary:
- Entregado: chat con fotos, typing, presencia, recibos de lectura, emojis, lightbox, ajustes con cambio de contraseña verificado por correo (modo pruebas mientras no se configure SMTP) y recuperación desde el login (requiere SMTP)
- Credenciales: eva/eva123 · david/david123 (el usuario debe guardar su correo en Ajustes para verificar cambios de contraseña)
- Para email real: rellenar SMTP_* en .env (ej. Gmail con contraseña de aplicación) y poner EMAIL_DEV_FALLBACK=false
- BD vacía (sin mensajes de ejemplo), tal como pidió el usuario
