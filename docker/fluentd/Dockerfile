# fluentd/Dockerfile

FROM fluentd:v1.19-1
USER root
RUN ["gem", "install", "fluent-plugin-elasticsearch", "--no-document", "--version", "6.0.0"]
USER fluent