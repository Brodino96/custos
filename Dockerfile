# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:slim AS base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS build
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
RUN bun install --frozen-lockfile
RUN bun bundle

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/dev/node_modules node_modules
COPY --from=build /usr/src/app/dist/* /usr/src/app/
COPY --from=build /usr/src/app/config.example.json /usr/src/app/
COPY --from=build /usr/src/app/entrypoint.sh /usr/src/app/

# Make entrypoint script executable
RUN chmod +x /usr/src/app/entrypoint.sh
# Fix line endings for Windows compatibility
RUN sed -i 's/\r$//' /usr/src/app/entrypoint.sh

# run the app (entrypoint runs as root to create config, then app runs as bun)
EXPOSE 8080/tcp
ENTRYPOINT ["/usr/src/app/entrypoint.sh", "bun", "run", "main.js"]