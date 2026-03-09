# ui/Dockerfile

# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_BASE=""
ENV VITE_API_BASE=${VITE_API_BASE}

ARG VITE_MOBILE_API_BASE=""
ENV VITE_MOBILE_API_BASE=${VITE_MOBILE_API_BASE}

ARG VITE_VEHICLE_PROFILE=""
ENV VITE_VEHICLE_PROFILE=${VITE_VEHICLE_PROFILE}

ARG VITE_DEMO_HOST_PREFIX=""
ENV VITE_DEMO_HOST_PREFIX=${VITE_DEMO_HOST_PREFIX}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Runtime stage ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback (React Router friendly)
RUN printf 'server {\n\
  listen 80;\n\
  server_name _;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
