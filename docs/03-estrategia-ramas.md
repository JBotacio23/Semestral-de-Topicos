# Estrategia de ramas y flujo de trabajo — Sprint 0

## Modelo: GitLab Flow con rama única de integración

```
main ────●───────●───────●───────●────────▶  (staging auto-deploy en cada merge)
          \      /         \     /
  feature/HU-01          feature/HU-02
```

- **`main`**: rama protegida. Siempre desplegable. Cada merge dispara deploy a **staging**.
- **`feature/<HU-id>-<slug>`**: una rama por historia de usuario o tarea.
  Ej.: `feature/HU-01-crear-solicitud`, `chore/setup-gitlab-ci`.
- **Producción**: se despliega desde `main` mediante el job manual del pipeline
  (`deploy:prod`, `when: manual`), no desde una rama aparte. Se etiqueta con `vX.Y`
  (`git tag v0.1` al cierre de cada sprint).

## Reglas de `main` (Settings → Repository → Protected branches)

- Prohibido el push directo. Todo entra por **Merge Request**.
- MR requiere: **1 aprobación** de otro integrante + **pipeline en verde**.
- Merge con *squash* activado (historial limpio, 1 commit por MR).
- Borrar la rama de origen al mergear.

## Convención de commits

Prefijos: `feat:`, `fix:`, `test:`, `chore:`, `docs:`, `ci:`, `refactor:`, `sec:`.
Ejemplo: `feat(HU-01): generar número de trámite único al enviar solicitud`.

## Ciclo por historia de usuario

1. Crear issue en GitLab desde el backlog (PB-0X) y asignarlo.
2. `git checkout -b feature/HU-0X-... main`
3. Desarrollo + pruebas Cypress de esa HU + pruebas unitarias.
4. Push → se abre MR (`Draft:` mientras está en progreso).
5. Pipeline corre `build → test → security → e2e`.
6. Revisión de otro integrante (mínimo el rol relacionado: QA revisa tests,
   Seguridad revisa políticas RLS nuevas).
7. Merge a `main` → deploy automático a staging → verificación manual.
8. Al cierre del sprint: tag `vX.Y` + promoción manual a producción.

## Roles en la revisión

| Cambio | Revisor obligatorio |
|---|---|
| Endpoints / lógica de negocio | Desarrollo / Arquitectura |
| Tests nuevos o modificados | QA / Testing Lead |
| Políticas RLS, auth, manejo de archivos | Responsable de Seguridad |
| `.gitlab-ci.yml`, migraciones, entornos | DevOps / CI-CD Lead |
