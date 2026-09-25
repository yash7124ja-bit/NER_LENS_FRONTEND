FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig*.json vite.config.* ./
COPY src ./src
COPY public ./public
RUN npm run build
FROM nginx:1.28-alpine@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf '%s\n' 'server {' 'listen 80;' 'root /usr/share/nginx/html;' 'location /v1/ { proxy_pass http://api:8000; proxy_set_header Host $host; proxy_set_header Origin $http_origin; proxy_buffering off; }' 'location /health { proxy_pass http://api:8000; proxy_set_header Host $host; }' 'location / { try_files $uri $uri/ /index.html; }' '}' > /etc/nginx/conf.d/default.conf
