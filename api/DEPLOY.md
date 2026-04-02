# TangentFlow API — Deployment Guide

Complete step-by-step guide to deploy the TangentFlow API on a Hetzner server.

---

## 1. Server Setup (Hetzner)

### 1.1 SSH into your server

```bash
ssh root@YOUR_SERVER_IP
```

### 1.2 Update system

```bash
apt update && apt upgrade -y
```

### 1.3 Install Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Verify
docker --version
docker compose version
```

### 1.4 Install Nginx

```bash
apt install nginx -y
systemctl enable nginx
systemctl start nginx
```

### 1.5 Install Certbot (SSL)

```bash
apt install certbot python3-certbot-nginx -y
```

### 1.6 Create a non-root user (recommended)

```bash
adduser deploy
usermod -aG sudo deploy
usermod -aG docker deploy
su - deploy
```

---

## 2. DNS Setup

Go to your domain registrar (wherever tangentflow.com is managed) and add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | api | YOUR_HETZNER_SERVER_IP | 300 |

Wait for DNS propagation (5-30 minutes). Verify:

```bash
dig api.tangentflow.com
# Should return your server IP
```

---

## 3. Clone and Configure

### 3.1 Clone the repo

```bash
cd /home/deploy  # or wherever you prefer
git clone https://github.com/bibin765/tangentflow.git
cd tangentflow/api
```

### 3.2 Create environment file

```bash
cp .env.example .env
nano .env
```

Fill in your values:

```
PORT=3001
NODE_ENV=production
DODO_WEBHOOK_SECRET=your_dodo_webhook_secret_here
DODO_API_KEY=your_dodo_api_key_here
DATABASE_PATH=/app/data/tangentflow.db
CORS_ORIGINS=https://tangentflow.com,https://api.tangentflow.com
```

### 3.3 Create data directory

```bash
mkdir -p data
```

---

## 4. Build and Start the API

```bash
docker compose up -d --build
```

This will:
- Build the Docker image (installs Node.js 22 + canvas native deps)
- Start the Fastify server on port 3001
- Create SQLite database in `./data/tangentflow.db`

### Verify it's running

```bash
docker compose logs -f
# Should see: "TangentFlow API running on http://0.0.0.0:3001"

# Test locally
curl http://localhost:3001/health
# Should return: {"status":"ok","service":"tangentflow-api"}
```

---

## 5. Set Up Nginx Reverse Proxy

### 5.1 Copy the nginx config

```bash
sudo cp nginx.conf /etc/nginx/sites-available/api.tangentflow.com
sudo ln -s /etc/nginx/sites-available/api.tangentflow.com /etc/nginx/sites-enabled/
```

### 5.2 Remove default site (if exists)

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

### 5.3 Test and reload nginx

```bash
sudo nginx -t
# Should say: syntax is ok, test is successful

sudo systemctl reload nginx
```

At this point `http://api.tangentflow.com` should work (HTTP only).

---

## 6. SSL Certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d api.tangentflow.com
```

Follow the prompts:
- Enter your email
- Agree to terms
- Choose to redirect HTTP to HTTPS (option 2)

Verify:
```bash
curl https://api.tangentflow.com/health
# Should return: {"status":"ok","service":"tangentflow-api"}
```

### Auto-renewal (already set up by certbot, but verify)

```bash
sudo certbot renew --dry-run
```

---

## 7. Test the API

### 7.1 Sign up for a free API key

```bash
curl -X POST https://api.tangentflow.com/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com"}'
```

Response:
```json
{
  "apiKey": "tf_a1b2c3d4...",
  "tier": "free",
  "monthlyLimit": 100,
  "message": "Your API key is ready."
}
```

Save the `apiKey` value.

### 7.2 Generate your first PDF

```bash
curl -X POST https://api.tangentflow.com/v1/render \
  -H "Authorization: Bearer tf_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "page": { "size": "a4" },
    "metadata": { "title": "My First PDF" },
    "blocks": [
      { "type": "heading", "text": "Hello from TangentFlow API!", "level": 1 },
      { "type": "paragraph", "text": "This PDF was generated server-side with **pixel-perfect** text wrapping." },
      { "type": "table", "headers": "Feature, Status", "rows": "Text wrapping, Working\nTable layout, Working\nMulti-language, Working" }
    ]
  }' \
  -o my-first-pdf.pdf
```

Open `my-first-pdf.pdf` — should show a formatted document.

### 7.3 Check usage

```bash
curl https://api.tangentflow.com/v1/usage \
  -H "Authorization: Bearer tf_YOUR_KEY_HERE"
```

Response:
```json
{
  "tier": "free",
  "month": "2026-04",
  "used": 1,
  "limit": 100,
  "remaining": 99
}
```

### 7.4 Test rate limiting

```bash
# Send 15 rapid requests (free tier allows 10/min)
for i in $(seq 1 15); do
  echo "Request $i:"
  curl -s -o /dev/null -w "%{http_code}" \
    -X POST https://api.tangentflow.com/v1/render \
    -H "Authorization: Bearer tf_YOUR_KEY_HERE" \
    -H "Content-Type: application/json" \
    -d '{"blocks":[{"type":"heading","text":"Test","level":1}]}'
  echo ""
done
# First 10 should return 200, after that 429 (rate limited)
```

---

## 8. Dodo Payments Setup

### 8.1 Create subscription products

Log into [Dodo Payments dashboard](https://app.dodopayments.com) and create 3 subscription products:

| Product Name | Price | Billing |
|---|---|---|
| TangentFlow Starter | $9 | Monthly |
| TangentFlow Growth | $29 | Monthly |
| TangentFlow Scale | $99 | Monthly |

Note the **product IDs** for each (e.g., `prod_xxx`).

### 8.2 Update product ID mapping

Edit `api/routes/webhooks.js` on the server, find the `mapProductToTier` function and add your product IDs:

```javascript
function mapProductToTier(productId) {
  const mapping = {
    'prod_YOUR_STARTER_ID': 'starter',
    'prod_YOUR_GROWTH_ID': 'growth',
    'prod_YOUR_SCALE_ID': 'scale',
  }
  return mapping[productId] || 'starter'
}
```

Then rebuild:
```bash
docker compose up -d --build
```

### 8.3 Set up webhook

In Dodo Payments dashboard:
1. Go to **Webhooks** (or Developer settings)
2. Add webhook URL: `https://api.tangentflow.com/webhooks/dodo`
3. Select events: `subscription.active`, `subscription.cancelled`, `payment.failed`
4. Copy the **webhook secret**
5. Update your `.env`:
   ```
   DODO_WEBHOOK_SECRET=dodo_whsec_your_secret_here
   ```
6. Restart:
   ```bash
   docker compose restart
   ```

### 8.4 Test webhook (optional)

Use Dodo's webhook testing tool or curl:
```bash
curl -X POST https://api.tangentflow.com/webhooks/dodo \
  -H "Content-Type: application/json" \
  -d '{"type":"subscription.active","data":{"customer_id":"test@example.com","customer":{"email":"test@example.com"},"product_id":"prod_YOUR_STARTER_ID","id":"sub_test123"}}'
```

---

## 9. Ongoing Maintenance

### View logs

```bash
docker compose logs -f api
```

### Restart the API

```bash
docker compose restart
```

### Update to latest code

```bash
cd /home/deploy/tangentflow
git pull
cd api
docker compose up -d --build
```

### Backup database

```bash
cp api/data/tangentflow.db api/data/tangentflow.db.backup
# Or set up a cron job:
# 0 3 * * * cp /home/deploy/tangentflow/api/data/tangentflow.db /home/deploy/backups/tangentflow-$(date +\%Y\%m\%d).db
```

### Monitor disk usage

```bash
du -sh api/data/tangentflow.db
# SQLite should stay small — a few MB even with millions of rows
```

### Check Docker resource usage

```bash
docker stats tangentflow-api
```

---

## 10. Upgrade Pricing Page on Website

After the API is live, update the pricing page at `tangentflow.com/pricing` to:
1. Add "API Access" to Pro tier features
2. Add signup/checkout links that go through Dodo Payments
3. Add API documentation link

---

## Troubleshooting

### API returns 502 Bad Gateway
- Check if Docker container is running: `docker compose ps`
- Check logs: `docker compose logs api`
- Verify port: `curl http://localhost:3001/health`

### SSL certificate not working
- Verify DNS: `dig api.tangentflow.com`
- Re-run certbot: `sudo certbot --nginx -d api.tangentflow.com`

### Canvas/Pretext errors in Docker
- The Dockerfile installs all native canvas dependencies
- If errors persist: `docker compose build --no-cache`

### Database locked errors
- SQLite uses WAL mode (set in db.js) — should handle concurrent reads
- If persistent: the volume mount in docker-compose.yml may need permissions fix:
  ```bash
  chmod 777 api/data/
  ```

### Webhook not triggering
- Check webhook URL is exactly: `https://api.tangentflow.com/webhooks/dodo`
- Check SSL is valid: `curl -I https://api.tangentflow.com/webhooks/dodo`
- Check Dodo dashboard for failed webhook deliveries
- Check logs: `docker compose logs api | grep webhook`

---

## Architecture Summary

```
Internet
  │
  ▼
Nginx (port 443, SSL)
  │
  ▼
Fastify (port 3001, Docker)
  ├── /v1/signup      → Create free API key
  ├── /v1/render      → JSON → PDF bytes
  ├── /v1/usage       → Usage stats
  ├── /v1/keys        → Key management
  ├── /webhooks/dodo  → Payment events
  └── /health         → Health check
  │
  ├── SQLite (data/tangentflow.db)
  │   ├── api_keys
  │   ├── usage
  │   └── subscriptions
  │
  └── @upbrew/tangentflow + pdf-lib + node-canvas
      └── renderFromSchema() → renderToPDF() → PDF bytes
```
