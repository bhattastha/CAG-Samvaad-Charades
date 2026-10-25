# Test credentials (preview)
- Email OTP only (NODE_ENV=production; dev code 123456 is rejected).
- Manager: bhattastha.dibd@gmail.com (ADMIN_EMAILS in /app/backend/.env).
- QA: plant a code with `/app/scripts/emergent/test-otp.sh <email> <6-digit code>`, then verify via UI or POST /api/auth/otp/verify (skip /otp/request: it overwrites the code).
- Test player created by QA: qa.tester1@cag.gov.in (1 Trial attempt, 1 Primary attempt).
