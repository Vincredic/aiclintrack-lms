FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

COPY . .

ARG VITE_CTMS_ORIGIN=https://app.yourdomain.com
ENV VITE_CTMS_ORIGIN=$VITE_CTMS_ORIGIN
ARG VITE_ADMIN_KEY=
ENV VITE_ADMIN_KEY=$VITE_ADMIN_KEY
ARG VITE_PROGRESS_API_URL=
ENV VITE_PROGRESS_API_URL=$VITE_PROGRESS_API_URL

RUN npm run build

FROM nginx:alpine-slim

LABEL com.centurylinklabs.watchtower.enable="false"

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
