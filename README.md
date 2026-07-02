# BeerOl

BeerOl is the website and backend for the Beer Olympics event. It includes the public event pages, ticket and T-shirt preorder pages, gallery, hall of fame, brackets, comments, Own The Moment voting, and backend APIs for registrations, comments, voting, and preorder confirmation emails.

## Project Structure

- `beerolympics-master/` - static frontend website
- `beerbackend-master/` - Express/PostgreSQL backend

## Frontend

The frontend is a static HTML/CSS/JavaScript site. Large gallery images are optimized to WebP and served from:

```text
beerolympics-master/media/gallery-optimized/
```

Original gallery images are intentionally ignored from Git:

```text
beerolympics-master/media/gallery/
```

## Backend

The backend uses:

- Express
- PostgreSQL
- Nodemailer
- dotenv

Required production environment variables:

```text
DATABASE_URL=postgresql://postgres.pvzxsfblhnugduyqnixd:YOUR-PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
MAIL_USER=
MAIL_PASS=
ORGANIZER_EMAIL=
```

Local `.env` files are ignored and should not be committed.

## Deploy Notes

This repo is set up as one Vercel project:

- static frontend files are served from `beerolympics-master/`
- backend API is served from `/api`
- frontend code calls `/api`, not a separate Render backend

Set the required environment variables in the Vercel project dashboard before deploying. The frontend assets have been optimized for a deploy-safe size.
