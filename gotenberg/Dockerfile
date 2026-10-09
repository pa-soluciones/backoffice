# Gotenberg (LibreOffice) con las fuentes de los Word de PAS, para que el PDF salga idéntico.
# Local: docker compose up. Producción: Google Cloud Run (ver spec/01-arquitectura.md §7).
FROM gotenberg/gotenberg:8

USER root
COPY fonts/*.ttf /usr/local/share/fonts/poppins/
RUN fc-cache -f
USER gotenberg
