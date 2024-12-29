# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package manager files to install dependencies
COPY . .

# Install corepack and yarn, then install dependencies
RUN corepack enable && yarn set version stable && yarn install && yarn compile

EXPOSE 6006
CMD ["yarn", "storybook:ci"]
