FROM denoland/deno:2.1.2

WORKDIR /app

# Cache dependencies
COPY deno.json .
# COPY .env . # Optional: let's use environment variables in docker-compose.yml

COPY . .

# Pre-cache dependencies
RUN deno cache main.ts

EXPOSE 8000

CMD ["task", "start"]
