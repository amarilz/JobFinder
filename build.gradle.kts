plugins {
    java
    id("org.springframework.boot") version "3.5.3"
    id("io.spring.dependency-management") version "1.1.7"
    id("org.openapi.generator") version "7.14.0"
    kotlin("jvm")
}

group = "com.amarildo"
version = "1.0.0"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

configurations {
    compileOnly {
        extendsFrom(configurations.annotationProcessor.get())
    }
}

// Configurazione Spring Boot per specificare la main class
springBoot {
    mainClass = "com.amarildo.jobfinder.JobfinderApplication"
}

// Costanti per i path e configurazioni
object Config {
    const val OPENAPI_SPEC_PATH = "src/main/resources/yaml/jobfinder_v1.0.0.yaml"
    const val GENERATED_OUTPUT_DIR = "build/generated"
    const val GENERATED_SRC_DIR = "build/generated/src/main/java"
    const val API_PACKAGE = "com.amarildo.openapi.api"
    const val INVOKER_PACKAGE = "com.amarildo.openapi.invoker"
    const val MODEL_PACKAGE = "com.amarildo.openapi.model"
}

val buildDir = layout.buildDirectory.get()
sourceSets {
    main {
        java {
            srcDirs(
                "src/main/java",  // Le tue classi
                Config.GENERATED_SRC_DIR      // Classi generate
            )
        }
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation(kotlin("stdlib-jdk8"))
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("io.swagger.core.v3:swagger-annotations:2.2.34")

    // database
    runtimeOnly("com.h2database:h2")
    runtimeOnly("org.postgresql:postgresql")

    // per prometheus
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    runtimeOnly("io.micrometer:micrometer-registry-prometheus")

    // reduce boilerplate code
    compileOnly("org.projectlombok:lombok")
    compileOnly("org.mapstruct:mapstruct:1.6.3")
    annotationProcessor("org.projectlombok:lombok-mapstruct-binding:0.2.0")
    annotationProcessor("org.mapstruct:mapstruct-processor:1.6.3")
    annotationProcessor("org.projectlombok:lombok")
    implementation("org.jetbrains:annotations:26.0.2")

    // for HTML strings handling
    implementation("org.jsoup:jsoup:1.21.1") // per togliere HTML dal body del job posting

    // for language detection
    implementation("com.github.pemistahl:lingua:1.2.2")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
    useJUnitPlatform()
}

openApiValidate {
    inputSpec.set(Config.OPENAPI_SPEC_PATH)
}

openApiGenerate {
    val buildDirectory = layout.buildDirectory.get()

    generatorName.set("spring")
    inputSpec.set(Config.OPENAPI_SPEC_PATH)
    outputDir.set("$buildDirectory/generated")
    apiPackage.set(Config.API_PACKAGE)
    invokerPackage.set(Config.INVOKER_PACKAGE)
    modelPackage.set(Config.MODEL_PACKAGE)
    generateApiTests.set(false)
    generateModelTests.set(false)

    configOptions.apply {
        put("dateLibrary", "java8")
        put("library", "spring-boot")
        put("useSpringBoot3", "true")
        put("useBeanValidation", "true")
        put("useOptional", "true")
        put("openApiNullable", "false")
        put("documentationProvider", "none")
        put("booleanGetterPrefix", "is")
        put("useTags", "true")
        put("interfaceOnly", "true") // non mi serve invoker
        put("unhandledException", "true") // per generare controller che possa lanciare eccezioni (per exception handler)
        put("additionalModelTypeAnnotations", """
            @lombok.NoArgsConstructor
            @lombok.Getter
            @lombok.Setter
            @lombok.ToString""".trimIndent())
    }
    typeMappings.apply {
        put("DateTime", "LocalDateTime") // per usare LocalDateTime invece di OffsetDateTime
        put("Date", "LocalDate")
    }
    importMappings.apply {
        put("LocalDateTime", "java.time.LocalDateTime")
        put("LocalDate", "java.time.LocalDate")
    }
}

// Configurazione delle dipendenze tra task
tasks.named("openApiGenerate") {
    dependsOn("openApiValidate")

    doLast {
        logger.info("Generazione OpenAPI completata in: ${Config.GENERATED_OUTPUT_DIR}")
    }
}

tasks.named("compileJava") {
    dependsOn("openApiValidate", "openApiGenerate")
}

tasks.named("compileKotlin") {
    dependsOn("openApiValidate", "openApiGenerate")
}
