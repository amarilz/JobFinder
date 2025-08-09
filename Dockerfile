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

# Variabili runtime (possono essere sovrascritte con -e in docker run)
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

# Utente non-root (UBI usa useradd)
RUN useradd -r -u 1001 -g root spring
USER 1001

WORKDIR /app

# Copia il jar dall’immagine builder (nome generico)
ARG JAR=build/libs/app.jar
COPY --from=builder /home/gradle/project/build/libs/*.jar /app/app.jar

EXPOSE 8080

# ENTRYPOINT che avvia l'applicazione e specifica il file di proprietà da usare
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Dspring.config.location=file:./application.properties -jar app.jar"]
