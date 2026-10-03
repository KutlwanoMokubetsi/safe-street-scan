#!/bin/bash
# Starts Keycloak. If KC_RECOVERY_ADMIN_PASSWORD is set, first creates a temporary admin in the master realm
# (Keycloak's official recovery for a lost admin password). Remove the variable once you've signed in.
if [ -n "$KC_RECOVERY_ADMIN_PASSWORD" ]; then
  USER="${KC_RECOVERY_ADMIN_USERNAME:-recovery-admin}"
  echo "Recovery: creating temporary admin '$USER' in the master realm"
  /opt/keycloak/bin/kc.sh bootstrap-admin user --optimized --username "$USER" --password:env KC_RECOVERY_ADMIN_PASSWORD --no-prompt \
    || /opt/keycloak/bin/kc.sh bootstrap-admin user --username "$USER" --password:env KC_RECOVERY_ADMIN_PASSWORD --no-prompt \
    || echo "Recovery: admin '$USER' was not created (it may already exist). Starting normally."
fi
exec /opt/keycloak/bin/kc.sh start --optimized --import-realm
