# Storybook Development

To showcase usage of the components, a Storybook is included.

## Prerequisites

Before launching Storybook, an instance of the Liturgical Calendar API must be running locally
at [http://localhost:8000](http://localhost:8000).

## Running Storybook

```bash
# Install dependencies first
yarn install

# Launch on a random free port
yarn storybook

# Launch on a specific port
yarn storybook --port 6006
```

## Custom API Port

If you have the Liturgical Calendar API running on a port other than 8000,
set the `STORYBOOK_API_PORT` environment variable:

```bash
STORYBOOK_API_PORT=8092 yarn storybook
```

Alternatively, copy `.env.example` to `.env` and set the value there:

```bash
cp .env.example .env
# Edit .env and set STORYBOOK_API_PORT=8092
```

## Docker Setup

To simplify getting a running instance of the API, you can use Docker.

### Building the API Image

Build the Docker image from the [Dockerfile](https://github.com/Liturgical-Calendar/LiturgicalCalendarAPI/blob/development/Dockerfile)
in the Liturgical Calendar API repository.

### Docker Compose

Use the provided `docker-compose.yml` to launch both the API and Storybook:

```bash
docker compose up -d
```

### Customizing Ports with Docker

Use a `.env` file in the same folder as `docker-compose.yml`:

```bash
# .env
STORYBOOK_API_PORT=8092
```

> [!NOTE]
> You'll also need to mount the `.env` file into the container.
> See the comments in `docker-compose.yml` for details.

### Image Sizes

The Docker images are approximately:
- API: ~1.09 GB
- Storybook: ~657 MB
- Total: ~1.76 GB

> [!NOTE]
> While it's often possible to reduce Docker image sizes using multi-stage builds with Alpine,
> the Liturgical Calendar API requires system language packages that aren't available in Alpine.
