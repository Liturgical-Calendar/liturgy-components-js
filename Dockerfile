# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package manager files to install dependencies
COPY ./src ./src
COPY ./.storybook ./.storybook
COPY  ./package.json ./yarn.lock ./tsconfig.json ./

# Install corepack and yarn, install dependencies
RUN corepack enable && yarn set version stable && yarn install

EXPOSE 6006

# Compile src to dist and watch for changes in src, and lauch storybook on port 6006 on the internal docker network
CMD ["yarn", "docker"]
