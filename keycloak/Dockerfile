# Keycloak for CrimeSpot. Builds an optimized image with Postgres support and imports the realm on first start.
FROM quay.io/keycloak/keycloak:26.4 AS builder
ENV KC_DB=postgres
ENV KC_HEALTH_ENABLED=true
ENV KC_CACHE=local
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.4
COPY --from=builder /opt/keycloak/ /opt/keycloak/
COPY realm/ /opt/keycloak/data/import/
# Tuned to fit 512 MB. Keycloak picks its own garbage collector, so do not add one here.
# On a 2 GB plan, delete these two ENV lines to use Keycloak defaults.
ENV JAVA_OPTS_KC_HEAP="-Xms64m -Xmx224m -XX:MaxMetaspaceSize=128m -XX:ReservedCodeCacheSize=32m -XX:MaxDirectMemorySize=32m -Xss256k -XX:TieredStopAtLevel=1"
ENV KC_CACHE=local MALLOC_ARENA_MAX=2 KC_DB_POOL_INITIAL_SIZE=1 KC_DB_POOL_MIN_SIZE=1 KC_DB_POOL_MAX_SIZE=5
EXPOSE 8080
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized", "--import-realm"]
