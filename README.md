# CompuBasics-ITEC106
E-Learning for Grade 6 Students

## Deployment

Recommended setup:

- Frontend: Vercel
- Backend: Railway
- Database: Railway PostgreSQL

Backend environment variables on Railway:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=replace-with-a-long-random-secret
PORT=4000
```

Use `DB_SSL=true` only if your PostgreSQL provider requires SSL.

Deploy the backend from the `backend` folder. After Railway creates the PostgreSQL database and sets `DATABASE_URL`, run:

```bash
npm run seed
node scripts/reset_admin.js
```

Frontend environment variable on Vercel:

```env
VITE_API_BASE=https://your-railway-backend-url/api
```
