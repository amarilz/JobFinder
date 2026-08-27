# ====== STAGE 1: BUILD ======
FROM gradle:8.14.2-jdk21-corretto AS builder
WORKDIR /home/gradle/project

# Cache dipendenze
COPY build.gradle.kts settings.gradle.kts gradle.properties* ./
COPY gradle ./gradle
RUN gradle --no-daemon dependencies || true

# Build
COPY . .
RUN gradle --no-daemon clean bootJar

# ====== STAGE 2: RUNTIME ======
FROM eclipse-temurin:21-jre-ubi9-minimal

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

# Crea utente/gruppo non-root
RUN groupadd -g 1001 spring && useradd -r -u 1001 -g spring spring

WORKDIR /app

# Precrea la dir dei log dentro l'immagine (utile anche quando il volume non è montato)
RUN mkdir -p /app/logs && chown -R spring:spring /app

# Copia il jar
COPY --from=builder /home/gradle/project/build/libs/*.jar /app/app.jar

# Copia l'entrypoint che sistema i permessi del volume e droppa i privilegi
COPY /docker/app/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

# Rimaniamo root per poter fare chown sul volume montato, poi droppiamo a 'spring'
ENTRYPOINT ["/app/entrypoint.sh"]
