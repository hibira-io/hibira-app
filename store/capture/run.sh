#!/bin/bash
exec env ENVIRONMENT=development STANDALONE_MODE=true LOG_FORMAT=text \
 PUSHER_APP_ID=local-app PUSHER_APP_KEY=local-key PUSHER_APP_SECRET=local-secret-0123456789 \
 ADMIN_ENABLED=true SETUP_TOKEN=dev-setup-token-0123456789 \
 BILLING_ENABLED=true BILLING_PUBLIC_URL=http://localhost:8080 \
 LIVECHAT_ENABLED=true LIVECHAT_PUBLIC_URL=http://chat.localhost:8080 \
 APPROVALS_PUBLIC_URL=http://approvals.localhost:8080 \
 SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_SECURITY=none MAIL_FROM=noreply@hibira.example ASSISTANT_MODEL=off "${HBDEMO:-./hbdemo}" serve
